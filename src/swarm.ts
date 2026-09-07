import { App } from "obsidian";
import { defaultModelFor, PROVIDER_LABELS, SwarmSettings, TranscriptMessage } from "./types";
import { callModel, ProviderApiError, ProviderErrorKind } from "./providers";
import {
	extractListRequests,
	extractReadRequests,
	extractWriteRequests,
	fileAccessInstructions,
	listFolderForAgent,
	PendingChange,
	readExistingForDiff,
	readFileForAgent,
	resolveProjectPath,
} from "./agentFileOps";

/** How much of the transcript to keep (most recent messages) when we hit a token-limit error. */
const SHRINK_KEEP_FRACTION = 0.5;
const MIN_KEEP_MESSAGES = 2;

function formatTranscript(topic: string, messages: TranscriptMessage[], truncatedNotice?: string): string {
	const lines: string[] = [`Topic under discussion: ${topic}`, ""];
	if (truncatedNotice) {
		lines.push(`[${truncatedNotice}]`, "");
	}
	for (const m of messages) {
		lines.push(`[Round ${m.round}] ${m.agentName}: ${m.content}`);
		lines.push("");
	}
	return lines.join("\n");
}

function shrinkTranscript(messages: TranscriptMessage[]): TranscriptMessage[] {
	const keepCount = Math.max(MIN_KEEP_MESSAGES, Math.floor(messages.length * SHRINK_KEEP_FRACTION));
	return messages.slice(-keepCount);
}

/**
 * Calls a model for one agent turn. Transient errors (rate limits, 5xx/503) are already
 * retried with backoff inside callModel. Token-limit errors are different: retrying the
 * identical request will just fail again, so here we shrink the transcript to the most
 * recent messages and retry once. If it still doesn't fit, we surface a clear, actionable
 * error instead of a raw API message.
 */
async function callAgentWithTokenLimitHandling(
	settings: SwarmSettings,
	provider: Parameters<typeof callModel>[1],
	model: string,
	systemPrompt: string,
	topic: string,
	transcript: TranscriptMessage[],
	buildInstruction: (context: string) => string,
	apiKeyOverride: string | undefined,
	onRetry?: (attempt: number, kind: ProviderErrorKind, reason: string) => void
): Promise<string> {
	try {
		const context = formatTranscript(topic, transcript);
		return await callModel(settings, provider, model, systemPrompt, buildInstruction(context), apiKeyOverride, onRetry);
	} catch (err) {
		if (err instanceof ProviderApiError && err.kind === "token_limit" && transcript.length > MIN_KEEP_MESSAGES) {
			const shrunk = shrinkTranscript(transcript);
			const context = formatTranscript(
				topic,
				shrunk,
				`Note: the debate so far is long, so only the most recent ${shrunk.length} of ${transcript.length} messages are shown above`
			);
			try {
				return await callModel(
					settings,
					provider,
					model,
					systemPrompt,
					buildInstruction(context),
					apiKeyOverride,
					onRetry
				);
			} catch (err2) {
				const reason = err2 instanceof Error ? err2.message : String(err2);
				throw new Error(
					`Transcript is too long for this model even after trimming. Try fewer rounds/agents, or a model ` +
						`with a larger context window. (${reason})`
				);
			}
		}
		throw err;
	}
}

/**
 * Runs the full debate: for each round, every agent responds in turn, seeing everything
 * said so far. Each agent calls whichever provider/model it's configured with, so a
 * single debate can span multiple AI models. Calls onMessage as each agent finishes so
 * the UI can render incrementally.
 *
 * If settings.swarmFileAccessEnabled and a project root are set, agents are told (via a
 * note appended to the topic) that they can request file reads and propose file writes
 * using a fenced-block convention. Reads are resolved automatically and folded into the
 * transcript; writes are never applied here — they're surfaced via onPendingChange so the
 * UI can queue them for the person to manually approve or reject.
 */
export async function runDebate(
	app: App,
	settings: SwarmSettings,
	topic: string,
	onMessage: (msg: TranscriptMessage) => void,
	shouldStop: () => boolean,
	onAgentStart?: (agentId: string, round: number) => void,
	onAgentError?: (agentId: string, round: number) => void,
	onAgentRetry?: (agentId: string, round: number, attempt: number, kind: ProviderErrorKind, reason: string) => void,
	onPendingChange?: (change: PendingChange) => void
): Promise<TranscriptMessage[]> {
	const transcript: TranscriptMessage[] = [];

	const root = settings.swarmProjectRoot.trim();
	const effectiveTopic =
		settings.swarmFileAccessEnabled ? `${topic}\n\n${fileAccessInstructions(root)}` : topic;

	for (let round = 1; round <= settings.rounds; round++) {
		for (const agent of settings.agents) {
			if (shouldStop()) return transcript;

			onAgentStart?.(agent.id, round);

			const model = agent.model || defaultModelFor(settings, agent.provider);

			let content: string;
			try {
				content = await callAgentWithTokenLimitHandling(
					settings,
					agent.provider,
					model,
					agent.systemPrompt,
					effectiveTopic,
					transcript,
					(context) =>
						transcript.length === 0
							? `${context}\nYou go first. Respond to the topic above.`
							: `${context}\nNow respond as ${agent.name}, building on, challenging, or adding to the discussion so far.`,
					agent.apiKeyOverride,
					(attempt, kind, reason) => onAgentRetry?.(agent.id, round, attempt, kind, reason)
				);
			} catch (err) {
				onAgentError?.(agent.id, round);
				const reason = err instanceof Error ? err.message : String(err);
				throw new Error(`${agent.name} (${PROVIDER_LABELS[agent.provider]}) failed: ${reason}`);
			}

			if (settings.swarmFileAccessEnabled) {
				content = await resolveFileRequests(app, root, agent.name, round, content, onPendingChange);
			}

			const msg: TranscriptMessage = {
				agentId: agent.id,
				agentName: agent.name,
				color: agent.color,
				round,
				provider: agent.provider,
				content,
			};
			transcript.push(msg);
			onMessage(msg);
		}
	}

	return transcript;
}

/**
 * Handles any ```agent-file-read``` / ```agent-file-write``` blocks in an agent's reply:
 * read requests get resolved and their results appended to the message content (so they
 * become part of the transcript future turns see); write requests are turned into
 * PendingChange objects and handed to onPendingChange — nothing is written to disk here.
 */
async function resolveFileRequests(
	app: App,
	root: string,
	agentName: string,
	round: number,
	content: string,
	onPendingChange?: (change: PendingChange) => void
): Promise<string> {
	let appended = "";

	const lists = extractListRequests(content);
	for (const relPath of lists) {
		const listing = await listFolderForAgent(app, root, relPath);
		const label = relPath || "(project root)";
		appended +=
			`\n\n---\n**[Automatic folder listing: \`${label}\`]**\n\`\`\`\n` +
			(listing ?? "(folder not found, or path was rejected for safety)") +
			`\n\`\`\`\n`;
	}

	const reads = extractReadRequests(content);
	for (const relPath of reads) {
		const fileContent = await readFileForAgent(app, root, relPath);
		appended +=
			`\n\n---\n**[Automatic file read: \`${relPath}\`]**\n\`\`\`\n` +
			(fileContent ?? "(file not found, unreadable, or path was rejected for safety)") +
			`\n\`\`\`\n`;
	}

	const writes = extractWriteRequests(content);
	for (let i = 0; i < writes.length; i++) {
		const { relPath, newContent } = writes[i];
		const fullPath = resolveProjectPath(root, relPath);
		if (!fullPath) {
			appended += `\n\n---\n**[Proposed change to \`${relPath}\` was rejected: path is outside the project folder or invalid.]**\n`;
			continue;
		}
		const oldContent = await readExistingForDiff(app, fullPath);
		const change: PendingChange = {
			id: `${agentName}-r${round}-${i}-${Date.now()}`,
			agentName,
			round,
			relPath,
			fullPath,
			newContent,
			oldContent,
			timestamp: Date.now(),
		};
		onPendingChange?.(change);
		appended += `\n\n---\n**[Proposed a change to \`${relPath}\` — waiting for your approval in the Pending changes panel.]**\n`;
	}

	return content + appended;
}

/**
 * Reads the full transcript and produces a synthesized markdown note, using whichever
 * provider/model is configured for synthesis (independent of the debating agents).
 */
export async function runSynthesis(
	settings: SwarmSettings,
	topic: string,
	transcript: TranscriptMessage[],
	onRetry?: (attempt: number, kind: ProviderErrorKind, reason: string) => void
): Promise<string> {
	const model = settings.synthesisModel || defaultModelFor(settings, settings.synthesisProvider);

	try {
		return await callAgentWithTokenLimitHandling(
			settings,
			settings.synthesisProvider,
			model,
			settings.synthesisPrompt,
			topic,
			transcript,
			(context) => `${context}\nWrite the synthesis note now.`,
			undefined,
			onRetry
		);
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		throw new Error(`Synthesis (${PROVIDER_LABELS[settings.synthesisProvider]}) failed: ${reason}`);
	}
}
