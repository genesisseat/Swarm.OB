import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment, Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { php } from "@codemirror/lang-php";
import { xml } from "@codemirror/lang-xml";

export type CodeLanguageKey =
	| "javascript"
	| "typescript"
	| "python"
	| "html"
	| "css"
	| "json"
	| "markdown"
	| "cpp"
	| "java"
	| "rust"
	| "sql"
	| "php"
	| "xml"
	| "plaintext";

export interface LanguageOption {
	key: CodeLanguageKey;
	label: string;
	extension: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
	{ key: "javascript", label: "JavaScript", extension: "js" },
	{ key: "typescript", label: "TypeScript", extension: "ts" },
	{ key: "python", label: "Python", extension: "py" },
	{ key: "html", label: "HTML", extension: "html" },
	{ key: "css", label: "CSS", extension: "css" },
	{ key: "json", label: "JSON", extension: "json" },
	{ key: "markdown", label: "Markdown", extension: "md" },
	{ key: "cpp", label: "C / C++", extension: "cpp" },
	{ key: "java", label: "Java", extension: "java" },
	{ key: "rust", label: "Rust", extension: "rs" },
	{ key: "sql", label: "SQL", extension: "sql" },
	{ key: "php", label: "PHP", extension: "php" },
	{ key: "xml", label: "XML", extension: "xml" },
	{ key: "plaintext", label: "Plain text", extension: "txt" },
];

/** Maps common markdown fence info strings (```py, ```js, etc.) to our language keys. */
const FENCE_INFO_MAP: Record<string, CodeLanguageKey> = {
	js: "javascript",
	javascript: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	ts: "typescript",
	typescript: "typescript",
	tsx: "typescript",
	py: "python",
	python: "python",
	html: "html",
	htm: "html",
	css: "css",
	json: "json",
	md: "markdown",
	markdown: "markdown",
	cpp: "cpp",
	"c++": "cpp",
	c: "cpp",
	java: "java",
	rs: "rust",
	rust: "rust",
	sql: "sql",
	php: "php",
	xml: "xml",
};

export function languageKeyFromFenceInfo(info: string): CodeLanguageKey | null {
	const key = info.trim().toLowerCase().split(/\s+/)[0];
	return FENCE_INFO_MAP[key] ?? null;
}

/** Extensions (without the dot) known to be plain text/code — safe to load into the editor. */
const TEXT_EXTENSIONS = new Set([
	"js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "html", "htm", "css", "scss", "less",
	"json", "jsonc", "md", "markdown", "mdx", "c", "h", "cpp", "cc", "cxx", "hpp", "java",
	"rs", "sql", "php", "xml", "txt", "yaml", "yml", "toml", "ini", "cfg", "conf", "sh",
	"bash", "zsh", "env", "gitignore", "gitattributes", "csv", "tsv", "log", "svg",
]);

/** Extensions known to be binary — never attempt to load these into the text editor. */
const BINARY_EXTENSIONS = new Set([
	"png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "pdf", "mp3", "mp4", "mov", "wav",
	"ogg", "webm", "zip", "tar", "gz", "7z", "rar", "exe", "dll", "so", "dylib", "ttf",
	"otf", "woff", "woff2", "eot", "sqlite", "db",
]);

export function isBinaryExtension(ext: string): boolean {
	return BINARY_EXTENSIONS.has(ext.toLowerCase());
}

/** True for known text extensions, and for files with no/short extension (config files, etc. default to editable). */
export function isTextEditable(ext: string): boolean {
	const e = ext.toLowerCase();
	if (BINARY_EXTENSIONS.has(e)) return false;
	if (TEXT_EXTENSIONS.has(e)) return true;
	return e.length <= 6; // no/unknown short extension: assume text rather than block it
}

export function languageKeyFromExtension(ext: string): CodeLanguageKey {
	const e = ext.toLowerCase();
	const found = LANGUAGE_OPTIONS.find((o) => o.extension === e);
	if (found) return found.key;
	// A few extra aliases not covered by LANGUAGE_OPTIONS' canonical extension.
	const aliases: Record<string, CodeLanguageKey> = {
		jsx: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		tsx: "typescript",
		htm: "html",
		scss: "css",
		less: "css",
		jsonc: "json",
		markdown: "markdown",
		mdx: "markdown",
		h: "cpp",
		cc: "cpp",
		cxx: "cpp",
		hpp: "cpp",
		yaml: "plaintext",
		yml: "plaintext",
	};
	return aliases[e] ?? "plaintext";
}


function languageExtension(key: CodeLanguageKey): Extension | null {
	switch (key) {
		case "javascript":
			return javascript({ jsx: true });
		case "typescript":
			return javascript({ jsx: true, typescript: true });
		case "python":
			return python();
		case "html":
			return html();
		case "css":
			return css();
		case "json":
			return json();
		case "markdown":
			return markdown();
		case "cpp":
			return cpp();
		case "java":
			return java();
		case "rust":
			return rust();
		case "sql":
			return sql();
		case "php":
			return php();
		case "xml":
			return xml();
		case "plaintext":
		default:
			return null;
	}
}

// Maps CodeMirror's look to Obsidian's own CSS variables so the editor matches whatever
// theme (light/dark/community) the user has active, rather than looking like a foreign widget.
const obsidianTheme = EditorView.theme({
	"&": {
		color: "var(--text-normal)",
		backgroundColor: "var(--background-primary)",
		height: "100%",
		width: "100%",
		fontSize: "var(--font-text-size, 14px)",
	},
	".cm-content": { fontFamily: "var(--font-monospace)", caretColor: "var(--text-normal)" },
	".cm-gutters": { backgroundColor: "var(--background-secondary)", color: "var(--text-faint)", border: "none" },
	".cm-activeLine": { backgroundColor: "var(--background-modifier-hover)" },
	".cm-activeLineGutter": { backgroundColor: "var(--background-modifier-hover)" },
	".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
		backgroundColor: "var(--text-selection) !important",
	},
	"&.cm-focused": { outline: "none" },
	".cm-scroller": { overflow: "auto" },
});

/**
 * A CodeMirror 6 editor instance wired to Obsidian's theme, supporting on-the-fly language
 * switching via a Compartment (so switching languages doesn't require rebuilding the whole
 * editor / losing undo history).
 */
export class CodeEditor {
	private view: EditorView;
	private languageCompartment = new Compartment();
	private resizeObserver: ResizeObserver;

	constructor(
		container: HTMLElement,
		initialDoc = "",
		initialLanguage: CodeLanguageKey = "plaintext",
		onChange?: (doc: string) => void
	) {
		const langExt = languageExtension(initialLanguage);
		const state = EditorState.create({
			doc: initialDoc,
			extensions: [
				lineNumbers(),
				highlightActiveLine(),
				highlightActiveLineGutter(),
				drawSelection(),
				history(),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				autocompletion(),
				highlightSelectionMatches(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				keymap.of([
					...closeBracketsKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					...completionKeymap,
					indentWithTab,
				]),
				this.languageCompartment.of(langExt ? [langExt] : []),
				obsidianTheme,
				EditorView.lineWrapping,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) onChange?.(update.state.doc.toString());
				}),
			],
		});
		this.view = new EditorView({ state, parent: container });

		// CodeMirror measures line/gutter layout against the container's size at construction
		// time. If the container is zero-size or mid-resize right then — which happens often
		// here, e.g. a brand-new popout window that hasn't finished laying out yet, or a panel
		// tab that was hidden (display:none) at mount — those measurements get locked in wrong
		// and the gutter numbers and content desync (numbers bunched at the top, text rendered
		// as one unpositioned block below). Re-requesting a measure on every resize fixes both
		// the initial-mount case and any later window/pane resizing.
		this.resizeObserver = new ResizeObserver(() => {
			this.view.requestMeasure();
		});
		this.resizeObserver.observe(container);
	}

	getValue(): string {
		return this.view.state.doc.toString();
	}

	setValue(doc: string): void {
		this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: doc } });
	}

	setLanguage(key: CodeLanguageKey): void {
		const ext = languageExtension(key);
		this.view.dispatch({ effects: this.languageCompartment.reconfigure(ext ? [ext] : []) });
	}

	focus(): void {
		this.view.focus();
	}

	destroy(): void {
		this.resizeObserver.disconnect();
		this.view.destroy();
	}
}
