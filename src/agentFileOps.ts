import { App, TFile, TFolder } from "obsidian";

export interface FileWriteRequest {
	/** Vault-relative path within the project root, e.g. "src/index.js". */
	relPath: string;
	newContent: string;
}

export interface PendingChange {
	id: string;
	agentName: string;
	round: number;
	relPath: string;
	fullPath: string;
	newContent: string;
	/** null = file doesn't exist yet (this would create it). */
	oldContent: string | null;
	timestamp: number;
}

const READ_BLOCK_RE = /```agent-file-read\s*\n([^\n`]+)\n```/g;
const WRITE_BLOCK_RE = /```agent-file-write\s+path="([^"]+)"\s*\n([\s\S]*?)```/g;
const LIST_BLOCK_RE = /```agent-file-list\s*\n([^\n`]*)\n```/g;

/**
 * The instructions injected into agent prompts so they know this capability exists and the
 * exact syntax to use. Only ever added when the user has both enabled file access AND set a
 * project root — agents get no hint this exists otherwise.
 */
export function fileAccessInstructions(projectRoot: string): string {
	const rootLabel = projectRoot || "(vault root)";
	return (
		`You have limited file access to a project folder: "${rootLabel}". You may list folders, read files, ` +
		`and propose changes, but you cannot write directly — every proposed change is queued for the person ` +
		`to manually review and approve or reject before anything is written to disk, and approved changes are ` +
		`logged. To see what actually exists before guessing file names, list a folder's contents (leave the ` +
		`path empty for the project root itself):\n` +
		'```agent-file-list\n' +
		`relative/path/to/folder\n` +
		'```\n' +
		`To read a file, include this exact block (path relative to the project folder):\n` +
		'```agent-file-read\n' +
		`relative/path/to/file.ext\n` +
		'```\n' +
		`Results for both are added to the transcript automatically before the next turn. Prefer listing a ` +
		`folder before guessing whether a file exists in it. To propose writing or overwriting a file, include:\n` +
		'```agent-file-write path="relative/path/to/file.ext"\n' +
		`<the full new file contents>\n` +
		'```\n' +
		`Only use these blocks when a file operation is actually relevant to the discussion — don't use them ` +
		`speculatively, and don't propose a write without a real reason tied to the topic.`
	);
}

export function extractReadRequests(text: string): string[] {
	const results: string[] = [];
	let m: RegExpExecArray | null;
	READ_BLOCK_RE.lastIndex = 0;
	while ((m = READ_BLOCK_RE.exec(text))) {
		const path = m[1].trim();
		if (path) results.push(path);
	}
	return results;
}

export function extractWriteRequests(text: string): FileWriteRequest[] {
	const results: FileWriteRequest[] = [];
	let m: RegExpExecArray | null;
	WRITE_BLOCK_RE.lastIndex = 0;
	while ((m = WRITE_BLOCK_RE.exec(text))) {
		const relPath = m[1].trim();
		const content = m[2].replace(/\n$/, "");
		if (relPath) results.push({ relPath, newContent: content });
	}
	return results;
}

/** Extracted paths to list (an empty string means "the project root itself"). */
export function extractListRequests(text: string): string[] {
	const results: string[] = [];
	let m: RegExpExecArray | null;
	LIST_BLOCK_RE.lastIndex = 0;
	while ((m = LIST_BLOCK_RE.exec(text))) {
		results.push(m[1].trim());
	}
	return results;
}

/**
 * Resolves a (possibly malicious) relative path against the project root, refusing anything
 * that tries to escape it. Returns null if the path is unsafe.
 */
export function resolveProjectPath(root: string, relPath: string): string | null {
	const cleaned = relPath.replace(/\\/g, "/").trim();
	if (!cleaned || cleaned.startsWith("/") || /^[a-zA-Z]:/.test(cleaned)) return null; // absolute paths rejected

	const segments = cleaned.split("/").filter((s) => s.length > 0 && s !== ".");
	if (segments.some((s) => s === "..")) return null; // no traversal, even partial

	const joined = segments.join("/");
	return root ? `${root}/${joined}` : joined;
}

/**
 * Same safety rules as resolveProjectPath, but an empty/"." path means "the project root
 * folder itself" rather than being rejected — useful for listing, where "show me the root" is
 * a normal, common request.
 */
function resolveProjectFolderPath(root: string, relPath: string): string | null {
	const cleaned = relPath.replace(/\\/g, "/").trim();
	if (cleaned === "" || cleaned === ".") return root;
	if (cleaned.startsWith("/") || /^[a-zA-Z]:/.test(cleaned)) return null;

	const segments = cleaned.split("/").filter((s) => s.length > 0 && s !== ".");
	if (segments.some((s) => s === "..")) return null;

	const joined = segments.join("/");
	return root ? `${root}/${joined}` : joined;
}

export async function readFileForAgent(app: App, root: string, relPath: string): Promise<string | null> {
	const fullPath = resolveProjectPath(root, relPath);
	if (!fullPath) return null;
	const file = app.vault.getAbstractFileByPath(fullPath);
	if (!(file instanceof TFile)) return null;
	try {
		return await app.vault.read(file);
	} catch {
		return null;
	}
}

/**
 * Lists the immediate children of a folder (not recursive — keeps output compact and cheap).
 * Folders sort first, then files, both alphabetically; folders get a trailing "/" so agents
 * can tell them apart from files at a glance. Returns null if the path is unsafe or isn't a
 * folder; returns a friendly placeholder string for a genuinely empty folder.
 */
export async function listFolderForAgent(app: App, root: string, relPath: string): Promise<string | null> {
	const fullPath = resolveProjectFolderPath(root, relPath);
	if (fullPath === null) return null;

	const folder = fullPath === "" ? app.vault.getRoot() : app.vault.getAbstractFileByPath(fullPath);
	if (!(folder instanceof TFolder)) return null;

	const items = [...folder.children].sort((a, b) => {
		const aFolder = a instanceof TFolder;
		const bFolder = b instanceof TFolder;
		if (aFolder !== bFolder) return aFolder ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	if (items.length === 0) return "(empty folder)";
	return items.map((f) => (f instanceof TFolder ? `${f.name}/` : f.name)).join("\n");
}

export async function readExistingForDiff(app: App, fullPath: string): Promise<string | null> {
	const file = app.vault.getAbstractFileByPath(fullPath);
	if (!(file instanceof TFile)) return null;
	try {
		return await app.vault.read(file);
	} catch {
		return null;
	}
}

async function ensureFolderChain(app: App, path: string): Promise<void> {
	if (!path) return;
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return;
	try {
		await app.vault.createFolder(path);
	} catch {
		// Likely already exists (race) — fine either way.
	}
}

/** Writes an approved change to disk, creating parent folders as needed. */
export async function applyChange(app: App, change: PendingChange): Promise<void> {
	const dir = change.fullPath.includes("/") ? change.fullPath.slice(0, change.fullPath.lastIndexOf("/")) : "";
	if (dir) await ensureFolderChain(app, dir);

	const existing = app.vault.getAbstractFileByPath(change.fullPath);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, change.newContent);
	} else {
		await app.vault.create(change.fullPath, change.newContent);
	}
}

/** Appends a row to the project's changelog file, creating it with a header if it doesn't exist yet. */
export async function logChange(
	app: App,
	root: string,
	changelogFileName: string,
	change: PendingChange
): Promise<void> {
	const path = root ? `${root}/${changelogFileName}` : changelogFileName;
	const action = change.oldContent === null ? "Created" : "Modified";
	const date = new Date(change.timestamp).toISOString().replace("T", " ").slice(0, 19);
	const row = `| ${date} | ${change.agentName} | round ${change.round} | ${action} | \`${change.relPath}\` |\n`;

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		const current = await app.vault.read(existing);
		await app.vault.modify(existing, current + row);
	} else {
		const header =
			`# Agent changes log\n\n` +
			`Every change an agent proposed and you approved in this project, in order.\n\n` +
			`| Date | Agent | Round | Action | File |\n| --- | --- | --- | --- | --- |\n`;
		await app.vault.create(path, header + row);
	}
}
