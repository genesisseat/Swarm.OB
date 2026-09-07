import { ItemView, WorkspaceLeaf, Notice, setIcon, TFile } from "obsidian";
import type AgentSwarmPlugin from "./main";
import { AgentSwarmView, VIEW_TYPE_AGENT_SWARM } from "./view";
import { FileTree } from "./fileTree";
import { FolderPickerModal } from "./folderPickerModal";
import { NamePromptModal } from "./namePromptModal";
import {
	CodeEditor,
	CodeLanguageKey,
	LANGUAGE_OPTIONS,
	isBinaryExtension,
	isTextEditable,
	languageKeyFromExtension,
} from "./codeEditor";

export const VIEW_TYPE_CODE_EDITOR = "agent-swarm-code-editor-view";

/**
 * A standalone project-style code editor: a file-tree sidebar scoped to a chosen root folder
 * (or the whole vault), and a CodeMirror editor pane. Meant to be opened via
 * workspace.openPopoutLeaf() into its own OS window, so it can sit alongside the main Agent
 * Swarm panel (Chat/Swarm) rather than competing with it for space in one window.
 */
export class CodeEditorView extends ItemView {
	plugin: AgentSwarmPlugin;

	private treeContainer!: HTMLElement;
	private fileTree!: FileTree;
	private editorContainer!: HTMLElement;
	private codeEditor!: CodeEditor;

	private languageSelect!: HTMLSelectElement;
	private pathLabel!: HTMLElement;
	private rootLabel!: HTMLElement;

	private currentFile: TFile | null = null;
	private dirty = false;

	constructor(leaf: WorkspaceLeaf, plugin: AgentSwarmPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CODE_EDITOR;
	}

	getDisplayText(): string {
		return "Code Editor";
	}

	getIcon(): string {
		return "folder-code";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("agent-swarm-code-editor-view");

		// --- Sidebar: file tree ---
		const sidebar = container.createDiv({ cls: "agent-swarm-code-sidebar" });

		const sidebarHeader = sidebar.createDiv({ cls: "agent-swarm-code-sidebar-header" });
		this.rootLabel = sidebarHeader.createSpan({
			cls: "agent-swarm-code-root-label",
			text: this.rootDisplayName(),
		});

		const openFolderBtn = sidebarHeader.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Open project folder" },
		});
		setIcon(openFolderBtn, "folder-open");
		openFolderBtn.addEventListener("click", () => this.openProjectFolderPicker());

		const newFolderBtn = sidebarHeader.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "New folder at root" },
		});
		setIcon(newFolderBtn, "folder-plus");
		newFolderBtn.addEventListener("click", () => this.newFolderAtRoot());

		this.treeContainer = sidebar.createDiv({ cls: "agent-swarm-filetree" });
		this.fileTree = new FileTree(this.treeContainer, this.app, this.plugin.settings.codeProjectRoot, {
			onOpenFile: (file) => this.openFile(file),
		});
		this.fileTree.render();

		// --- Main pane: toolbar + editor ---
		const main = container.createDiv({ cls: "agent-swarm-code-main" });

		const toolbar = main.createDiv({ cls: "agent-swarm-code-toolbar" });

		this.languageSelect = toolbar.createEl("select", { cls: "agent-swarm-code-lang-select" });
		for (const opt of LANGUAGE_OPTIONS) {
			this.languageSelect.createEl("option", { text: opt.label, value: opt.key });
		}
		this.languageSelect.value = "plaintext";
		this.languageSelect.addEventListener("change", () => {
			this.codeEditor.setLanguage(this.languageSelect.value as CodeLanguageKey);
		});

		this.pathLabel = toolbar.createSpan({ cls: "agent-swarm-code-path-label", text: "No file open" });

		toolbar.createDiv({ cls: "agent-swarm-composer-spacer" });

		const newFileBtn = toolbar.createEl("button", { cls: "agent-swarm-icon-btn", attr: { "aria-label": "New file" } });
		setIcon(newFileBtn, "file-plus");
		newFileBtn.addEventListener("click", () => this.newFile());

		const copyBtn = toolbar.createEl("button", { cls: "agent-swarm-icon-btn", attr: { "aria-label": "Copy contents" } });
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", () => this.copyContents());

		const sendBtn = toolbar.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Send to Chat" },
		});
		setIcon(sendBtn, "send-horizontal");
		sendBtn.addEventListener("click", () => this.sendToChat());

		const saveBtn = toolbar.createEl("button", {
			cls: "agent-swarm-icon-btn mod-cta",
			attr: { "aria-label": "Save (Cmd/Ctrl+S)" },
		});
		setIcon(saveBtn, "save");
		saveBtn.addEventListener("click", () => this.saveCurrentFile());

		this.editorContainer = main.createDiv({ cls: "agent-swarm-code-editor-container" });
		this.codeEditor = new CodeEditor(this.editorContainer, "", "plaintext", () => {
			this.dirty = true;
		});

		this.registerDomEvent(this.containerEl.ownerDocument, "keydown", (evt: KeyboardEvent) => {
			if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === "s") {
				evt.preventDefault();
				this.saveCurrentFile();
			}
		});
	}

	async onClose(): Promise<void> {
		this.codeEditor?.destroy();
	}

	private rootDisplayName(): string {
		const root = this.plugin.settings.codeProjectRoot;
		return root ? root : "Vault root";
	}

	private openProjectFolderPicker(): void {
		new FolderPickerModal(this.app, this.plugin.settings.codeProjectRoot, async (path) => {
			this.plugin.settings.codeProjectRoot = path;
			await this.plugin.saveSettings();
			this.rootLabel.setText(this.rootDisplayName());
			this.fileTree.setRoot(path);
		}).open();
	}

	private newFolderAtRoot(): void {
		new NamePromptModal(this.app, "New folder", "folder-name", async (name) => {
			const base = this.plugin.settings.codeProjectRoot;
			const path = base ? `${base}/${name}` : name;
			try {
				await this.app.vault.createFolder(path);
				this.fileTree.render();
			} catch (err) {
				new Notice(`Could not create folder: ${err instanceof Error ? err.message : String(err)}`);
			}
		}).open();
	}

	private newFile(): void {
		new NamePromptModal(this.app, "New file", "filename.ext", async (name) => {
			const base = this.plugin.settings.codeProjectRoot;
			const path = base ? `${base}/${name}` : name;
			try {
				const file = await this.app.vault.create(path, "");
				this.fileTree.render();
				this.openFile(file);
			} catch (err) {
				new Notice(`Could not create file: ${err instanceof Error ? err.message : String(err)}`);
			}
		}).open();
	}

	private async openFile(file: TFile): Promise<void> {
		if (isBinaryExtension(file.extension) || !isTextEditable(file.extension)) {
			new Notice(`"${file.name}" doesn't look like a text file — can't open it in the code editor.`);
			return;
		}

		if (this.dirty && this.currentFile) {
			// Best-effort autosave of whatever was open before switching, so nothing silently vanishes.
			await this.app.vault.modify(this.currentFile, this.codeEditor.getValue()).catch(() => {});
		}

		const content = await this.app.vault.read(file);
		this.currentFile = file;
		this.dirty = false;
		this.codeEditor.setValue(content);

		const langKey = languageKeyFromExtension(file.extension);
		this.languageSelect.value = langKey;
		this.codeEditor.setLanguage(langKey);
		this.pathLabel.setText(file.path);
	}

	private async saveCurrentFile(): Promise<void> {
		if (!this.currentFile) {
			new Notice("No file open — use \"New file\" first.");
			return;
		}
		try {
			await this.app.vault.modify(this.currentFile, this.codeEditor.getValue());
			this.dirty = false;
			new Notice(`Saved "${this.currentFile.path}"`);
		} catch (err) {
			new Notice(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	private async copyContents(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.codeEditor.getValue());
			new Notice("Copied to clipboard.");
		} catch {
			new Notice("Could not copy — clipboard access was blocked.");
		}
	}

	/**
	 * Hands the current file's contents to the main Agent Swarm panel's Chat tab. Works even
	 * though this view may be in a separate OS window, since Obsidian popout windows still
	 * share the same plugin/App instance — no cross-window messaging needed.
	 */
	private sendToChat(): void {
		const code = this.codeEditor.getValue();
		if (!code.trim()) {
			new Notice("Editor is empty — nothing to send.");
			return;
		}
		const lang = this.languageSelect.value as CodeLanguageKey;
		const fenceLang = lang === "plaintext" ? "" : lang;
		const label = this.currentFile ? this.currentFile.path : "this code";

		const text = `Here is \`${label}\`:\n\n\`\`\`${fenceLang}\n${code}\n\`\`\`\n\n`;

		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_SWARM);
		if (leaves.length === 0) {
			new Notice("Open the Agent Swarm panel first (ribbon icon or command palette).");
			return;
		}
		const view = leaves[0].view;
		if (view instanceof AgentSwarmView) {
			view.prefillChatFromExternal(text);
		}
	}
}
