import { ChatMessage, defaultModelFor, SwarmSettings } from "./types";
import { callModel, ProviderErrorKind } from "./providers";

/** How much of the history to keep (most recent messages) when we hit a token-limit error. */
const SHRINK_KEEP_FRACTION = 0.5;
const MIN_KEEP_MESSAGES = 2;

function formatHistory(messages: ChatMessage[], truncatedNotice?: string): string {
	const lines: string[] = [];
	if (truncatedNotice) {
		lines.push(`[${truncatedNotice}]`, "");
	}
	for (const m of messages) {
		lines.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
		lines.push("");
	}
	return lines.join("\n");
}

function shrinkHistory(messages: ChatMessage[]): ChatMessage[] {
	const keepCount = Math.max(MIN_KEEP_MESSAGES, Math.floor(messages.length * SHRINK_KEEP_FRACTION));
	return messages.slice(-keepCount);
}

/**
 * Sends the running conversation (including the just-added user message) to the
 * configured chat provider/model and returns the assistant's reply text.
 *
 * Mirrors the token-limit shrink-and-retry pattern used for the debate/synthesis calls
 * in swarm.ts: a "context too long" error triggers one retry with only the most recent
 * messages kept, rather than failing outright.
 */
export async function runChatReply(
	settings: SwarmSettings,
	history: ChatMessage[],
	onRetry?: (attempt: number, kind: ProviderErrorKind, reason: string) => void
): Promise<string> {
	const model = settings.chatModel || defaultModelFor(settings, settings.chatProvider);

	try {
		const context = formatHistory(history);
		return await callModel(
			settings,
			settings.chatProvider,
			model,
			settings.chatSystemPrompt,
			`${context}\nRespond as the Assistant to the conversation above.`,
			undefined,
			onRetry
		);
	} catch (err) {
		const anyErr = err as { kind?: ProviderErrorKind };
		if (anyErr?.kind === "token_limit" && history.length > MIN_KEEP_MESSAGES) {
			const shrunk = shrinkHistory(history);
			const context = formatHistory(
				shrunk,
				`Note: the conversation so far is long, so only the most recent ${shrunk.length} of ${history.length} messages are shown above`
			);
			return await callModel(
				settings,
				settings.chatProvider,
				model,
				settings.chatSystemPrompt,
				`${context}\nRespond as the Assistant to the conversation above.`,
				undefined,
				onRetry
			);
		}
		throw err;
	}
}
