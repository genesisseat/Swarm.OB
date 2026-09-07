import { requestUrl } from "obsidian";
import { Provider, SwarmSettings } from "./types";

export type ProviderErrorKind = "rate_limit" | "server" | "token_limit" | "auth" | "other";

/**
 * A classified provider error. `kind` drives how callers react:
 * - "rate_limit" / "server" (429 / 5xx, e.g. the classic 503 "overloaded"): transient,
 *   worth an automatic retry with backoff.
 * - "token_limit": the request itself is too large for the model's context window.
 *   Retrying identically will just fail again — the caller needs to shrink the
 *   transcript first (handled in swarm.ts, which controls transcript construction).
 * - "auth": bad/missing key. Not worth retrying.
 * - "other": anything else (bad request, content blocked, etc). Not worth retrying.
 */
export class ProviderApiError extends Error {
	constructor(message: string, public status: number, public kind: ProviderErrorKind) {
		super(message);
		this.name = "ProviderApiError";
	}
}

function classify(status: number, message: string): ProviderErrorKind {
	if (status === 429) return "rate_limit";
	if (status >= 500) return "server"; // includes the classic 503 "model overloaded"
	if (status === 401 || status === 403) return "auth";
	if (
		(status === 400 || status === 413) &&
		/token|context length|context window|maximum context|too long|too many tokens/i.test(message)
	) {
		return "token_limit";
	}
	return "other";
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 700;

/**
 * Tracks a rotation cursor per provider so successive calls spread across a key pool
 * instead of hammering the same key. Module-level state is fine here: it only needs to
 * persist for the lifetime of the app session, not across restarts.
 */
const rotationCursors: Partial<Record<Provider, number>> = {};

/**
 * Splits a settings field that may contain multiple API keys (one per line, and/or
 * comma-separated) into a clean list. Supports a single key too, for backwards compat.
 */
function parseKeyPool(raw: string): string[] {
	return raw
		.split(/[\n,]/)
		.map((k) => k.trim())
		.filter((k) => k.length > 0);
}

function nextKey(provider: Provider, keys: string[]): string {
	const cursor = rotationCursors[provider] ?? 0;
	rotationCursors[provider] = (cursor + 1) % keys.length;
	return keys[cursor % keys.length];
}

/**
 * Calls the given provider/model with a system prompt and a single user message
 * (the running transcript), and returns the plain-text reply.
 *
 * Provider and model are passed explicitly (rather than read off a single global
 * setting) so that each agent in the swarm can be wired to a different AI model.
 * API keys/base URLs still come from the shared settings, since those are
 * per-provider, not per-agent.
 *
 * Transient failures (429 rate limits, 5xx server errors like "503 overloaded") are
 * retried automatically with exponential backoff. Non-transient failures (bad key,
 * token limit exceeded, blocked content) are thrown immediately as a ProviderApiError
 * so the caller can react appropriately — e.g. swarm.ts shrinks the transcript and
 * retries once on a token_limit error, rather than blindly repeating the same request.
 *
 * We use Obsidian's requestUrl instead of fetch to avoid CORS issues inside Electron.
 */
export async function callModel(
	settings: SwarmSettings,
	provider: Provider,
	model: string,
	systemPrompt: string,
	userContent: string,
	apiKeyOverride?: string,
	onRetry?: (attempt: number, kind: ProviderErrorKind, reason: string) => void
): Promise<string> {
	let lastErr: unknown;

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await dispatch(settings, provider, model, systemPrompt, userContent, apiKeyOverride);
		} catch (err) {
			lastErr = err;

			const retryable = err instanceof ProviderApiError && (err.kind === "rate_limit" || err.kind === "server");
			if (!retryable || attempt === MAX_RETRIES) throw err;

			const reason = err instanceof Error ? err.message : String(err);
			onRetry?.(attempt, (err as ProviderApiError).kind, reason);

			const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 250;
			await sleep(delay);
		}
	}

	// Unreachable (loop always returns or throws), but keeps TypeScript happy.
	throw lastErr instanceof Error ? lastErr : new Error("Provider call failed.");
}

async function dispatch(
	settings: SwarmSettings,
	provider: Provider,
	model: string,
	systemPrompt: string,
	userContent: string,
	apiKeyOverride?: string
): Promise<string> {
	switch (provider) {
		case "anthropic":
			return callAnthropic(apiKeyOverride || settings.anthropicApiKey, model, systemPrompt, userContent);
		case "openai":
			return callOpenAICompatible(
				"https://api.openai.com/v1/chat/completions",
				apiKeyOverride || settings.openaiApiKey,
				model,
				"OpenAI",
				systemPrompt,
				userContent
			);
		case "deepseek":
			return callOpenAICompatible(
				"https://api.deepseek.com/chat/completions",
				apiKeyOverride || settings.deepseekApiKey,
				model,
				"DeepSeek",
				systemPrompt,
				userContent
			);
		case "google":
			return callGoogle(apiKeyOverride || settings.googleApiKey, model, systemPrompt, userContent);
		case "ollama":
			return callOllama(apiKeyOverride || settings.ollamaBaseUrl, model, systemPrompt, userContent);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

async function callAnthropic(
	apiKey: string,
	model: string,
	systemPrompt: string,
	userContent: string
): Promise<string> {
	if (!apiKey) {
		throw new ProviderApiError("Missing Anthropic API key. Set it in Agent Swarm settings.", 401, "auth");
	}

	const res = await requestUrl({
		url: "https://api.anthropic.com/v1/messages",
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model,
			max_tokens: 1024,
			system: systemPrompt,
			messages: [{ role: "user", content: userContent }],
		}),
		throw: false,
	});

	if (res.status >= 400) {
		const msg = extractErrorMessage(res.json);
		throw new ProviderApiError(`Anthropic API error (${res.status}): ${msg}`, res.status, classify(res.status, msg));
	}

	const blocks = res.json?.content ?? [];
	const text = blocks
		.filter((b: { type: string }) => b.type === "text")
		.map((b: { text: string }) => b.text)
		.join("\n")
		.trim();

	if (!text) throw new ProviderApiError("Anthropic API returned an empty response.", res.status, "other");
	return text;
}

/**
 * Shared caller for any OpenAI-compatible chat/completions endpoint (OpenAI itself,
 * DeepSeek, and most other hosted providers that mirror the OpenAI API shape).
 */
async function callOpenAICompatible(
	url: string,
	apiKey: string,
	model: string,
	providerLabel: string,
	systemPrompt: string,
	userContent: string
): Promise<string> {
	if (!apiKey) {
		throw new ProviderApiError(`Missing ${providerLabel} API key. Set it in Agent Swarm settings.`, 401, "auth");
	}

	const res = await requestUrl({
		url,
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userContent },
			],
		}),
		throw: false,
	});

	if (res.status >= 400) {
		const msg = extractErrorMessage(res.json);
		throw new ProviderApiError(
			`${providerLabel} API error (${res.status}): ${msg}`,
			res.status,
			classify(res.status, msg)
		);
	}

	const text = res.json?.choices?.[0]?.message?.content?.trim();
	if (!text) throw new ProviderApiError(`${providerLabel} API returned an empty response.`, res.status, "other");
	return text;
}

async function callGoogle(
	rawKeys: string,
	model: string,
	systemPrompt: string,
	userContent: string
): Promise<string> {
	const keys = parseKeyPool(rawKeys);
	if (keys.length === 0) {
		throw new ProviderApiError("Missing Google AI Studio API key. Set it in Agent Swarm settings.", 401, "auth");
	}

	let lastErr: ProviderApiError | null = null;

	// Try up to one full lap of the key pool. On rate-limit/quota errors (429) or
	// transient server errors (5xx, e.g. "503 model overloaded"), advance to the next
	// key instead of failing outright — a different key may not be rate-limited.
	for (let attempt = 0; attempt < keys.length; attempt++) {
		const apiKey = nextKey("google", keys);
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const res = await requestUrl({
			url,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: systemPrompt }] },
				contents: [{ role: "user", parts: [{ text: userContent }] }],
			}),
			throw: false,
		});

		if (res.status === 429 || res.status >= 500) {
			const msg = extractErrorMessage(res.json);
			lastErr = new ProviderApiError(
				`Google AI Studio API error (${res.status}) on key ${attempt + 1}/${keys.length}: ${msg}`,
				res.status,
				classify(res.status, msg)
			);
			continue; // rotate to the next key in the pool
		}

		if (res.status >= 400) {
			const msg = extractErrorMessage(res.json);
			throw new ProviderApiError(
				`Google AI Studio API error (${res.status}): ${msg}`,
				res.status,
				classify(res.status, msg)
			);
		}

		const parts = res.json?.candidates?.[0]?.content?.parts ?? [];
		const text = parts
			.map((p: { text?: string }) => p.text ?? "")
			.join("\n")
			.trim();

		if (!text) {
			const blockReason = res.json?.promptFeedback?.blockReason;
			throw new ProviderApiError(
				blockReason
					? `Google AI Studio blocked the response (${blockReason}).`
					: "Google AI Studio API returned an empty response.",
				res.status,
				"other"
			);
		}
		return text;
	}

	throw lastErr ?? new ProviderApiError("Google AI Studio API failed for all keys in the pool.", 0, "other");
}

async function callOllama(
	baseUrl: string,
	model: string,
	systemPrompt: string,
	userContent: string
): Promise<string> {
	const base = baseUrl.replace(/\/+$/, "");

	const res = await requestUrl({
		url: `${base}/api/chat`,
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			model,
			stream: false,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userContent },
			],
		}),
		throw: false,
	});

	if (res.status >= 400) {
		const msg = extractErrorMessage(res.json);
		throw new ProviderApiError(`Ollama error (${res.status}): ${msg}`, res.status, classify(res.status, msg));
	}

	const text = res.json?.message?.content?.trim();
	if (!text)
		throw new ProviderApiError("Ollama returned an empty response. Is the model pulled and running?", res.status, "other");
	return text;
}

function extractErrorMessage(json: unknown): string {
	try {
		const j = json as { error?: { message?: string } | string };
		if (!j) return "unknown error";
		if (typeof j.error === "string") return j.error;
		if (j.error?.message) return j.error.message;
		return JSON.stringify(json);
	} catch {
		return "unknown error";
	}
}
