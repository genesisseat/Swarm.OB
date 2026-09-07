import { App, normalizePath, TFile, TFolder } from "obsidian";
import { ChatMessage, PROVIDER_LABELS, Provider } from "./types";

declare const window: Window & { moment: (...args: unknown[]) => { format: (fmt: string) => string } };

const DATA_MARKER_START = "%%agent-swarm-chat-data";
const DATA_MARKER_END = "%%";
const INDEX_FILE_NAME = "Conversations.md";

export interface ChatNoteMeta {
	title: string;
	createdAt: number;
	provider: Provider;
	model: string;
}

/** Turns the first user message into a short, filesystem-safe title. */
export function titleFromFirstMessage(text: string): string {
	const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? text;
	const cleaned = firstLine
		.slice(0, 60)
		.replace(/[\\/:*?"<>|#[\]^]/g, "")
		.trim();
	return cleaned || "Chat";
}

function formatTime(epochMs: number): string {
	return window.moment(epochMs).format("h:mm A");
}

/**
 * Renders the conversation as a human-readable note, plus a hidden JSON data block
 * (inside an Obsidian `%% comment %%`, invisible in reading view) that lets us
 * reconstruct the exact message list when the note is reopened later — round-tripping
 * through the pretty markdown above it would be lossy for edge cases like messages
 * that themselves contain "---" or bold text.
 */
export function serializeChatNote(meta: ChatNoteMeta, messages: ChatMessage[]): string {
	const created = window.moment(meta.createdAt).format("YYYY-MM-DD HH:mm");
	const updated = window.moment(Date.now()).format("YYYY-MM-DD HH:mm");

	const frontmatter = [
		"---",
		"agent-swarm-chat: true",
		`title: "${meta.title.replace(/"/g, '\\"')}"`,
		`created: ${created}`,
		`updated: ${updated}`,
		`provider: ${meta.provider}`,
		`model: ${meta.model || "(default)"}`,
		"---",
		"",
	].join("\n");

	const heading = `# ${meta.title}\n\n`;

	const body = messages
		.map((m) => {
			const who = m.role === "user" ? "**You**" : "**Assistant**";
			return `${who} — ${formatTime(m.timestamp)}\n\n${m.content}`;
		})
		.join("\n\n---\n\n");

	const dataBlock = `\n\n${DATA_MARKER_START}\n${JSON.stringify(messages)}\n${DATA_MARKER_END}\n`;

	return frontmatter + heading + body + dataBlock;
}

/**
 * Reads a saved chat note back into a message list. Returns null if the file doesn't
 * look like one of our chat notes (e.g. it's an unrelated note in the same folder).
 */
export function parseChatNote(content: string): ChatMessage[] | null {
	const startIdx = content.indexOf(DATA_MARKER_START);
	if (startIdx === -1) return null;

	const jsonStart = startIdx + DATA_MARKER_START.length;
	const endIdx = content.indexOf(DATA_MARKER_END, jsonStart);
	if (endIdx === -1) return null;

	const raw = content.slice(jsonStart, endIdx).trim();
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return null;
		return parsed.filter(
			(m): m is ChatMessage =>
				m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
		);
	} catch {
		return null;
	}
}

function titleFromFrontmatter(content: string): string | null {
	const match = content.match(/^title:\s*"(.*)"\s*$/m);
	return match ? match[1].replace(/\\"/g, '"') : null;
}

export interface ChatNoteSummary {
	file: TFile;
	title: string;
	updatedAt: number;
	preview: string;
}

/** Ensures the configured chat folder exists (creating it if needed) and returns its normalized path. */
export async function ensureChatFolder(app: App, folderPath: string): Promise<string> {
	const path = normalizePath(folderPath.trim());
	if (!path || path === "/" || path === ".") return "";

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return path;
	if (existing instanceof TFile) {
		throw new Error(`"${path}" already exists as a file, not a folder.`);
	}

	// Create any missing parent folders too (vault.createFolder only makes one level).
	const parts = path.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current).catch(() => {
				/* race with another createFolder call — fine, keep going */
			});
		}
	}
	return path;
}

/** Lists saved chat notes in the given folder, most recently updated first. */
export async function listChatNotes(app: App, folderPath: string): Promise<ChatNoteSummary[]> {
	const path = normalizePath(folderPath.trim());
	const folder = path ? app.vault.getAbstractFileByPath(path) : app.vault.getRoot();
	if (!(folder instanceof TFolder)) return [];

	const summaries: ChatNoteSummary[] = [];
	for (const child of folder.children) {
		if (!(child instanceof TFile) || child.extension !== "md") continue;
		if (child.name === INDEX_FILE_NAME) continue;
		const content = await app.vault.cachedRead(child);
		const messages = parseChatNote(content);
		if (!messages) continue; // not one of our chat notes

		const title = titleFromFrontmatter(content) ?? child.basename;
		const lastUser = [...messages].reverse().find((m) => m.role === "user");
		summaries.push({
			file: child,
			title,
			updatedAt: child.stat.mtime,
			preview: (lastUser ?? messages[messages.length - 1])?.content.slice(0, 80) ?? "",
		});
	}

	summaries.sort((a, b) => b.updatedAt - a.updatedAt);
	return summaries;
}

/** Builds a collision-safe file name for a brand-new chat note. */
export function buildChatFileName(title: string): string {
	const timestamp = window.moment().format("YYYY-MM-DD HHmmss");
	return `${title} — ${timestamp}.md`;
}

/**
 * (Re)writes an index note — "Conversations.md" — in the chat folder that links to every
 * saved conversation with a wikilink. Obsidian's graph/link visualizer picks up those
 * links automatically, so this note becomes a hub connected to every chat, and every chat
 * shows up in the graph instead of sitting as an unlinked orphan.
 *
 * Regenerated in full each time (rather than appended to) so it stays accurate even if
 * notes were renamed or deleted outside the plugin, and so per-conversation previews stay
 * current as conversations grow.
 */
export async function updateConversationsIndex(app: App, folderPath: string): Promise<void> {
	const folder = normalizePath(folderPath.trim());
	const indexPath = folder ? `${folder}/${INDEX_FILE_NAME}` : INDEX_FILE_NAME;

	const notes = await listChatNotes(app, folderPath);

	const lines = [
		"---",
		"agent-swarm-conversations-index: true",
		`updated: ${window.moment().format("YYYY-MM-DD HH:mm")}`,
		"---",
		"",
		"# Conversations",
		"",
		"Auto-generated index of every chat saved by Agent Swarm's Chat mode — links below stay in " +
			"sync automatically. Open the graph or local graph view on this note to see them all connected.",
		"",
	];

	if (notes.length === 0) {
		lines.push("*No conversations yet — start one from the Chat tab.*");
	} else {
		for (const note of notes) {
			const when = window.moment(note.updatedAt).format("YYYY-MM-DD HH:mm");
			const previewSuffix = note.preview ? ` — ${note.preview}` : "";
			lines.push(`- [[${note.file.basename}|${note.title}]] (${when})${previewSuffix}`);
		}
	}

	const content = lines.join("\n") + "\n";

	const existing = app.vault.getAbstractFileByPath(indexPath);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await app.vault.create(indexPath, content);
	}
}

export function providerLabel(provider: Provider): string {
	return PROVIDER_LABELS[provider];
}
