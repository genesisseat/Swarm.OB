import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, setIcon, TFile } from "obsidian";
import type AgentSwarmPlugin from "./main";
import { ChatMessage, PROVIDER_LABELS, TranscriptMessage } from "./types";
import { runDebate, runSynthesis } from "./swarm";
import { runChatReply } from "./chat";
import { ProviderErrorKind } from "./providers";
import { SwarmNetworkGraph } from "./network";
import {
	buildChatFileName,
	ChatNoteSummary,
	ensureChatFolder,
	listChatNotes,
	parseChatNote,
	serializeChatNote,
	titleFromFirstMessage,
	updateConversationsIndex,
} from "./chatStore";
import { ChatHistoryModal } from "./chatHistoryModal";
import { CodeEditor, CodeLanguageKey, LANGUAGE_OPTIONS, languageKeyFromFenceInfo } from "./codeEditor";
import { applyChange, logChange, PendingChange } from "./agentFileOps";
import { FolderPickerModal } from "./folderPickerModal";
import { DEV_TEAM_AGENTS } from "./devTeamPreset";
import { ConfirmModal } from "./confirmModal";

export const VIEW_TYPE_AGENT_SWARM = "agent-swarm-view";

const COMPOSER_MIN_HEIGHT = 40; // px, roughly 1 line
const COMPOSER_MAX_HEIGHT = 200; // px, ~8 lines before it scrolls internally

type PanelMode = "swarm" | "chat" | "code";

export class AgentSwarmView extends ItemView {
	plugin: AgentSwarmPlugin;

	private mode: PanelMode = "swarm";
	private swarmTabBtn!: HTMLButtonElement;
	private chatTabBtn!: HTMLButtonElement;
	private swarmContainer!: HTMLElement;
	private chatContainer!: HTMLElement;

	private scrollEl!: HTMLElement;
	private emptyStateEl!: HTMLElement;
	private topicInput!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private useNoteBtn!: HTMLButtonElement;

	private networkContainer!: HTMLElement;
	private networkPanel!: HTMLElement;
	private networkToggleBtn!: HTMLButtonElement;
	private network!: SwarmNetworkGraph;
	private networkExpanded = true;

	// --- Swarm file read/write access ---
	private fileAccessToggle!: HTMLInputElement;
	private fileAccessRootLabel!: HTMLElement;
	private coderModeToggle!: HTMLInputElement;
	private autopilotToggle!: HTMLInputElement;
	private pendingChangesPanel!: HTMLElement;
	private pendingChangesList!: HTMLElement;
	private pendingChanges: PendingChange[] = [];

	private running = false;
	private stopRequested = false;
	private lastTopic = "";
	private lastTranscript: TranscriptMessage[] = [];
	private lastSynthesis = "";
	private retryStatusEl: HTMLElement | null = null;

	// --- Chat mode state ---
	private chatScrollEl!: HTMLElement;
	private chatEmptyStateEl!: HTMLElement;
	private chatInput!: HTMLTextAreaElement;
	private chatSendBtn!: HTMLButtonElement;
	private chatNewBtn!: HTMLButtonElement;
	private chatHistoryBtn!: HTMLButtonElement;
	private chatMessages: ChatMessage[] = [];
	private chatFile: TFile | null = null;
	private chatRunning = false;
	private chatRetryStatusEl: HTMLElement | null = null;

	// --- Code editor mode state ---
	private codeContainer!: HTMLElement;
	private codeTabBtn!: HTMLButtonElement;
	private codeEditor!: CodeEditor;
	private codeEditorContainer!: HTMLElement;
	private codeLanguageSelect!: HTMLSelectElement;
	private codeFileNameInput!: HTMLInputElement;
	private codeFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AgentSwarmPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT_SWARM;
	}

	getDisplayText(): string {
		return "Agent Swarm";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("agent-swarm-view");

		// --- Header (fixed) ---
		const header = container.createDiv({ cls: "agent-swarm-header" });
		header.createEl("div", { text: "Agent Swarm", cls: "agent-swarm-header-title" });

		const modeTabs = header.createDiv({ cls: "agent-swarm-mode-tabs" });
		this.swarmTabBtn = modeTabs.createEl("button", { text: "Swarm", cls: "agent-swarm-mode-tab" });
		this.chatTabBtn = modeTabs.createEl("button", { text: "Chat", cls: "agent-swarm-mode-tab" });
		this.codeTabBtn = modeTabs.createEl("button", { text: "Code", cls: "agent-swarm-mode-tab" });
		this.swarmTabBtn.addEventListener("click", () => this.setMode("swarm"));
		this.chatTabBtn.addEventListener("click", () => this.setMode("chat"));
		this.codeTabBtn.addEventListener("click", () => this.setMode("code"));

		const headerActions = header.createDiv({ cls: "agent-swarm-header-actions" });

		this.networkToggleBtn = headerActions.createEl("button", {
			cls: "agent-swarm-icon-btn agent-swarm-network-toggle",
			attr: { "aria-label": "Toggle swarm diagram" },
		});
		setIcon(this.networkToggleBtn, "git-branch");
		this.networkToggleBtn.addEventListener("click", () => {
			this.networkExpanded = !this.networkExpanded;
			this.networkPanel.style.display = this.networkExpanded ? "block" : "none";
		});

		this.chatNewBtn = headerActions.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "New chat" },
		});
		setIcon(this.chatNewBtn, "plus");
		this.chatNewBtn.addEventListener("click", () => this.startNewChat());

		this.chatHistoryBtn = headerActions.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Chat history" },
		});
		setIcon(this.chatHistoryBtn, "history");
		this.chatHistoryBtn.addEventListener("click", () => this.openChatHistory());

		// --- Swarm mode content ---
		this.swarmContainer = container.createDiv({ cls: "agent-swarm-mode-panel" });
		this.buildSwarmMode(this.swarmContainer);

		// --- Chat mode content ---
		this.chatContainer = container.createDiv({ cls: "agent-swarm-mode-panel" });
		this.buildChatMode(this.chatContainer);

		// --- Code editor mode content ---
		this.codeContainer = container.createDiv({ cls: "agent-swarm-mode-panel" });
		this.buildCodeMode(this.codeContainer);

		this.setMode("swarm");
	}

	async onClose(): Promise<void> {
		this.network?.clear();
		this.codeEditor?.destroy();
	}

	private setMode(mode: PanelMode): void {
		this.mode = mode;
		this.swarmContainer.style.display = mode === "swarm" ? "flex" : "none";
		this.chatContainer.style.display = mode === "chat" ? "flex" : "none";
		this.codeContainer.style.display = mode === "code" ? "flex" : "none";
		this.swarmTabBtn.toggleClass("agent-swarm-mode-tab-active", mode === "swarm");
		this.chatTabBtn.toggleClass("agent-swarm-mode-tab-active", mode === "chat");
		this.codeTabBtn.toggleClass("agent-swarm-mode-tab-active", mode === "code");
		this.networkToggleBtn.style.display = mode === "swarm" ? "flex" : "none";
		this.chatNewBtn.style.display = mode === "chat" ? "flex" : "none";
		this.chatHistoryBtn.style.display = mode === "chat" ? "flex" : "none";
		if (mode === "code") this.codeEditor?.focus();
	}

	/**
	 * Public so other views (e.g. the standalone Code Editor window, which may live in a
	 * separate OS window) can hand text to this panel's Chat composer. Obsidian popout windows
	 * still share the same plugin/App instance, so this works across windows without any IPC.
	 */
	public prefillChatFromExternal(text: string): void {
		const prefix = this.chatInput.value.trim() ? `${this.chatInput.value.trim()}\n\n` : "";
		this.chatInput.value = `${prefix}${text}`;
		this.setMode("chat");
		this.autoGrowChatComposer();
		this.chatInput.focus();
		this.app.workspace.revealLeaf(this.leaf);
	}

	private async buildSwarmMode(container: HTMLElement): Promise<void> {
		// --- File access bar (fixed) ---
		const fileAccessBar = container.createDiv({ cls: "agent-swarm-file-access-bar" });

		const toggleLabel = fileAccessBar.createEl("label", { cls: "agent-swarm-file-access-toggle" });
		this.fileAccessToggle = toggleLabel.createEl("input", { attr: { type: "checkbox" } });
		this.fileAccessToggle.checked = this.plugin.settings.swarmFileAccessEnabled;
		toggleLabel.createSpan({ text: "File access" });
		this.fileAccessToggle.addEventListener("change", async () => {
			this.plugin.settings.swarmFileAccessEnabled = this.fileAccessToggle.checked;
			if (!this.fileAccessToggle.checked && this.coderModeToggle.checked) {
				// File access is Coder Mode's whole reason to exist — turning it off takes Coder Mode with it.
				this.coderModeToggle.checked = false;
				await this.setCoderMode(false);
			}
			await this.plugin.saveSettings();
			this.updateFileAccessBar();
		});

		const coderModeLabel = fileAccessBar.createEl("label", { cls: "agent-swarm-file-access-toggle" });
		this.coderModeToggle = coderModeLabel.createEl("input", { attr: { type: "checkbox" } });
		this.coderModeToggle.checked = this.plugin.settings.coderModeEnabled;
		coderModeLabel.createSpan({ text: "Coder Mode" });
		this.coderModeToggle.setAttr("aria-label", "Swap to the built-in Dev Team roster (Architect/Backend/Frontend/Reviewer)");
		this.coderModeToggle.addEventListener("change", () => this.setCoderMode(this.coderModeToggle.checked));

		const autopilotLabel = fileAccessBar.createEl("label", { cls: "agent-swarm-file-access-toggle" });
		this.autopilotToggle = autopilotLabel.createEl("input", { attr: { type: "checkbox" } });
		this.autopilotToggle.checked = this.plugin.settings.swarmAutopilotEnabled;
		autopilotLabel.createSpan({ text: "Autopilot" });
		this.autopilotToggle.setAttr(
			"aria-label",
			"Apply proposed changes immediately instead of waiting for approval — use with caution"
		);
		this.autopilotToggle.addEventListener("change", () => this.handleAutopilotToggle());

		this.fileAccessRootLabel = fileAccessBar.createSpan({ cls: "agent-swarm-file-access-root" });

		const chooseFolderBtn = fileAccessBar.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Choose project folder" },
		});
		setIcon(chooseFolderBtn, "folder-open");
		chooseFolderBtn.addEventListener("click", () => {
			new FolderPickerModal(this.app, this.plugin.settings.swarmProjectRoot, async (path) => {
				this.plugin.settings.swarmProjectRoot = path;
				await this.plugin.saveSettings();
				this.updateFileAccessBar();
			}).open();
		});

		this.updateFileAccessBar();

		// --- Pending changes (fixed, collapsible, only shown once something's proposed) ---
		this.pendingChangesPanel = container.createDiv({ cls: "agent-swarm-pending-panel" });
		this.pendingChangesPanel.style.display = "none";
		const pendingHeader = this.pendingChangesPanel.createDiv({ cls: "agent-swarm-pending-header" });
		pendingHeader.createSpan({ text: "Pending changes", cls: "agent-swarm-pending-title" });
		this.pendingChangesList = this.pendingChangesPanel.createDiv({ cls: "agent-swarm-pending-list" });

		// --- Live swarm diagram (fixed, collapsible) ---
		this.networkPanel = container.createDiv({ cls: "agent-swarm-network-panel" });
		this.networkContainer = this.networkPanel.createDiv({ cls: "agent-swarm-network" });
		this.network = new SwarmNetworkGraph(this.networkContainer);
		this.networkPanel.createEl("p", {
			text: "The diagram lights up here once a debate starts.",
			cls: "agent-swarm-network-hint",
		});

		// --- Scrollable message area (fixed) ---
		this.scrollEl = container.createDiv({ cls: "agent-swarm-scroll" });

		this.emptyStateEl = this.scrollEl.createDiv({ cls: "agent-swarm-empty-state" });
		this.emptyStateEl.createEl("div", { text: "🐝", cls: "agent-swarm-empty-icon" });
		this.emptyStateEl.createEl("p", {
			text: "Type a topic below, or use the clip button to pull in the active note, then start the debate.",
		});

		// --- Composer (fixed at bottom) ---
		const composer = container.createDiv({ cls: "agent-swarm-composer" });

		this.topicInput = composer.createEl("textarea", {
			cls: "agent-swarm-composer-input",
			attr: { placeholder: "What should the swarm debate?", rows: "1" },
		});
		this.topicInput.addEventListener("input", () => this.autoGrowComposer());
		this.topicInput.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey) && !this.running) {
				evt.preventDefault();
				this.handleStart();
			}
		});

		const composerBtnRow = composer.createDiv({ cls: "agent-swarm-composer-btn-row" });

		this.useNoteBtn = composerBtnRow.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Insert active note content" },
		});
		setIcon(this.useNoteBtn, "paperclip");
		this.useNoteBtn.addEventListener("click", async () => {
			const active = this.app.workspace.getActiveFile();
			if (!active) {
				new Notice("No active note.");
				return;
			}
			this.topicInput.value = await this.app.vault.cachedRead(active);
			this.autoGrowComposer();
			this.topicInput.focus();
		});

		composerBtnRow.createDiv({ cls: "agent-swarm-composer-spacer" });

		this.sendBtn = composerBtnRow.createEl("button", {
			cls: "agent-swarm-send-btn mod-cta",
			attr: { "aria-label": "Start debate" },
		});
		setIcon(this.sendBtn, "arrow-up");
		this.sendBtn.addEventListener("click", () => {
			if (this.running) {
				this.stopRequested = true;
				this.setSendBtnState("stopping");
			} else {
				this.handleStart();
			}
		});

		if (this.plugin.settings.includeNoteByDefault) {
			const active = this.app.workspace.getActiveFile();
			if (active) {
				this.topicInput.value = await this.app.vault.cachedRead(active);
				this.autoGrowComposer();
			}
		}
	}

	// ================= Swarm file read/write access =================

	private updateFileAccessBar(): void {
		const enabled = this.plugin.settings.swarmFileAccessEnabled;
		const root = this.plugin.settings.swarmProjectRoot;
		this.fileAccessRootLabel.setText(
			enabled ? `Project: ${root || "(vault root)"}` : "Off — agents have no file access"
		);
		this.fileAccessRootLabel.toggleClass("agent-swarm-file-access-off", !enabled);
		this.coderModeToggle.disabled = !enabled;
		this.coderModeToggle.checked = this.plugin.settings.coderModeEnabled;
		this.autopilotToggle.disabled = !enabled;
		this.autopilotToggle.checked = this.plugin.settings.swarmAutopilotEnabled;
	}

	/**
	 * Turning Autopilot on skips the Pending changes review entirely, so it gets its own
	 * confirmation rather than just flipping silently — this is the one control in the plugin
	 * that deliberately removes a safety step, so it shouldn't feel like a casual checkbox.
	 */
	private handleAutopilotToggle(): void {
		if (this.autopilotToggle.checked) {
			new ConfirmModal(
				this.app,
				"Enable Autopilot?",
				"With Autopilot on, every file change an agent proposes is written to disk immediately — " +
					"there's no Pending changes review step and no chance to reject a bad proposal before " +
					"it's applied. Approved changes are still logged to the changelog either way. Are you sure?",
				"Enable Autopilot",
				async () => {
					this.plugin.settings.swarmAutopilotEnabled = true;
					await this.plugin.saveSettings();
					this.updateFileAccessBar();
					new Notice("Autopilot on — proposed changes will be applied automatically.");
				}
			).open();
			// Revert the checkbox visually until the user actually confirms; the modal's onConfirm
			// (or its absence, if cancelled) is the real source of truth via updateFileAccessBar().
			this.autopilotToggle.checked = this.plugin.settings.swarmAutopilotEnabled;
		} else {
			this.plugin.settings.swarmAutopilotEnabled = false;
			this.plugin.saveSettings();
			new Notice("Autopilot off — proposed changes go back to the Pending changes panel.");
		}
	}

	/**
	 * Swaps the active agent roster to the built-in Dev Team preset (Architect/Backend/
	 * Frontend/Reviewer) or back to whatever the person had configured before, snapshotting
	 * the "before" roster so a round trip doesn't lose custom edits.
	 */
	private async setCoderMode(enable: boolean): Promise<void> {
		if (enable === this.plugin.settings.coderModeEnabled) return;

		if (enable) {
			this.plugin.settings.coderModePreviousAgents = JSON.parse(JSON.stringify(this.plugin.settings.agents));
			this.plugin.settings.agents = JSON.parse(JSON.stringify(DEV_TEAM_AGENTS));
			this.plugin.settings.coderModeEnabled = true;
			new Notice("Coder Mode on — switched to the Dev Team roster (Architect / Backend / Frontend / Reviewer).");
		} else {
			if (this.plugin.settings.coderModePreviousAgents) {
				this.plugin.settings.agents = this.plugin.settings.coderModePreviousAgents;
			}
			this.plugin.settings.coderModePreviousAgents = null;
			this.plugin.settings.coderModeEnabled = false;
			new Notice("Coder Mode off — restored your previous agent roster.");
		}

		await this.plugin.saveSettings();
		this.coderModeToggle.checked = enable;
	}

	private async addPendingChange(change: PendingChange): Promise<void> {
		if (this.plugin.settings.swarmAutopilotEnabled) {
			try {
				await this.applyAndLog(change);
				new Notice(`Autopilot: applied change to "${change.relPath}" automatically.`);
			} catch (err) {
				new Notice(`Autopilot could not apply change to "${change.relPath}": ${err instanceof Error ? err.message : String(err)}`);
			}
			return;
		}
		this.pendingChanges.push(change);
		this.renderPendingChanges();
		new Notice(`${change.agentName} proposed a change to "${change.relPath}" — review it above the diagram.`);
	}

	private renderPendingChanges(): void {
		this.pendingChangesPanel.style.display = this.pendingChanges.length > 0 ? "block" : "none";
		this.pendingChangesList.empty();

		for (const change of this.pendingChanges) {
			const item = this.pendingChangesList.createDiv({ cls: "agent-swarm-pending-item" });

			const meta = item.createDiv({ cls: "agent-swarm-pending-meta" });
			const action = change.oldContent === null ? "create" : "modify";
			meta.createSpan({
				text: `${change.agentName} (round ${change.round}) wants to ${action} `,
			});
			meta.createEl("code", { text: change.relPath });

			const preview = item.createEl("pre", { cls: "agent-swarm-pending-preview" });
			const previewText =
				change.newContent.length > 600 ? change.newContent.slice(0, 600) + "\n…(truncated)" : change.newContent;
			preview.createEl("code", { text: previewText });

			const btnRow = item.createDiv({ cls: "agent-swarm-composer-btn-row" });
			const approveBtn = btnRow.createEl("button", { text: "Approve", cls: "mod-cta" });
			approveBtn.addEventListener("click", () => this.approvePendingChange(change.id));
			const rejectBtn = btnRow.createEl("button", { text: "Reject" });
			rejectBtn.addEventListener("click", () => this.rejectPendingChange(change.id));
		}
	}

	private async applyAndLog(change: PendingChange): Promise<void> {
		await applyChange(this.app, change);
		await logChange(this.app, this.plugin.settings.swarmProjectRoot, this.plugin.settings.swarmChangelogFile, change);
	}

	private async approvePendingChange(id: string): Promise<void> {
		const change = this.pendingChanges.find((c) => c.id === id);
		if (!change) return;
		try {
			await this.applyAndLog(change);
			new Notice(`Applied change to "${change.relPath}" and logged it.`);
		} catch (err) {
			new Notice(`Could not apply change: ${err instanceof Error ? err.message : String(err)}`);
			return;
		}
		this.pendingChanges = this.pendingChanges.filter((c) => c.id !== id);
		this.renderPendingChanges();
	}

	private rejectPendingChange(id: string): void {
		this.pendingChanges = this.pendingChanges.filter((c) => c.id !== id);
		this.renderPendingChanges();
	}

	private buildChatMode(container: HTMLElement): void {
		this.chatScrollEl = container.createDiv({ cls: "agent-swarm-scroll" });

		this.chatEmptyStateEl = this.chatScrollEl.createDiv({ cls: "agent-swarm-empty-state" });
		this.chatEmptyStateEl.createEl("div", { text: "💬", cls: "agent-swarm-empty-icon" });
		this.chatEmptyStateEl.createEl("p", {
			text:
				"Chat one-on-one with your configured assistant. Conversations are saved automatically to " +
				`"${this.plugin.settings.chatFolder || "(vault root)"}" as you go — use the history button above ` +
				"to come back to one.",
		});

		const composer = container.createDiv({ cls: "agent-swarm-composer" });

		this.chatInput = composer.createEl("textarea", {
			cls: "agent-swarm-composer-input",
			attr: { placeholder: "Message the assistant…", rows: "1" },
		});
		this.chatInput.addEventListener("input", () => this.autoGrowChatComposer());
		this.chatInput.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey) && !this.chatRunning) {
				evt.preventDefault();
				this.handleChatSend();
			}
		});

		const composerBtnRow = composer.createDiv({ cls: "agent-swarm-composer-btn-row" });
		composerBtnRow.createDiv({ cls: "agent-swarm-composer-spacer" });

		this.chatSendBtn = composerBtnRow.createEl("button", {
			cls: "agent-swarm-send-btn mod-cta",
			attr: { "aria-label": "Send message" },
		});
		setIcon(this.chatSendBtn, "arrow-up");
		this.chatSendBtn.addEventListener("click", () => this.handleChatSend());
	}

	private buildCodeMode(container: HTMLElement): void {
		const toolbar = container.createDiv({ cls: "agent-swarm-code-toolbar" });

		this.codeLanguageSelect = toolbar.createEl("select", { cls: "agent-swarm-code-lang-select" });
		for (const opt of LANGUAGE_OPTIONS) {
			this.codeLanguageSelect.createEl("option", { text: opt.label, value: opt.key });
		}
		this.codeLanguageSelect.value = "javascript";
		this.codeLanguageSelect.addEventListener("change", () => {
			const key = this.codeLanguageSelect.value as CodeLanguageKey;
			this.codeEditor.setLanguage(key);
			this.syncFileNameExtension(key);
		});

		this.codeFileNameInput = toolbar.createEl("input", {
			cls: "agent-swarm-code-filename-input",
			attr: { type: "text", value: "untitled.js", "aria-label": "File name" },
		});

		const popOutBtn = toolbar.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Open full project editor in a new window" },
		});
		setIcon(popOutBtn, "picture-in-picture-2");
		popOutBtn.addEventListener("click", () => this.plugin.activateCodeEditorWindow());

		toolbar.createDiv({ cls: "agent-swarm-composer-spacer" });

		const newBtn = toolbar.createEl("button", { cls: "agent-swarm-icon-btn", attr: { "aria-label": "New file" } });
		setIcon(newBtn, "file-plus");
		newBtn.addEventListener("click", () => this.newCodeFile());

		const copyBtn = toolbar.createEl("button", { cls: "agent-swarm-icon-btn", attr: { "aria-label": "Copy code" } });
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", () => this.copyCode());

		const sendBtn = toolbar.createEl("button", {
			cls: "agent-swarm-icon-btn",
			attr: { "aria-label": "Send code to Chat" },
		});
		setIcon(sendBtn, "send-horizontal");
		sendBtn.addEventListener("click", () => this.sendCodeToChat());

		const saveBtn = toolbar.createEl("button", { cls: "agent-swarm-icon-btn mod-cta", attr: { "aria-label": "Save file" } });
		setIcon(saveBtn, "save");
		saveBtn.addEventListener("click", () => this.saveCodeFile());

		this.codeEditorContainer = container.createDiv({ cls: "agent-swarm-code-editor-container" });
		this.codeEditor = new CodeEditor(this.codeEditorContainer, "", "javascript");
	}

	// ================= Code editor mode =================

	private codeExtensionFor(key: CodeLanguageKey): string {
		return LANGUAGE_OPTIONS.find((o) => o.key === key)?.extension ?? "txt";
	}

	private syncFileNameExtension(key: CodeLanguageKey): void {
		const current = this.codeFileNameInput.value.trim();
		const base = current.includes(".") ? current.slice(0, current.lastIndexOf(".")) : current || "untitled";
		this.codeFileNameInput.value = `${base}.${this.codeExtensionFor(key)}`;
	}

	private newCodeFile(): void {
		this.codeEditor.setValue("");
		this.codeFile = null;
		this.codeLanguageSelect.value = "javascript";
		this.codeEditor.setLanguage("javascript");
		this.codeFileNameInput.value = "untitled.js";
		this.codeEditor.focus();
	}

	private async copyCode(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.codeEditor.getValue());
			new Notice("Code copied to clipboard.");
		} catch {
			new Notice("Could not copy — your browser/OS blocked clipboard access.");
		}
	}

	private async saveCodeFile(): Promise<void> {
		const fileName = this.codeFileNameInput.value.trim();
		if (!fileName) {
			new Notice("Give the file a name first.");
			return;
		}
		const content = this.codeEditor.getValue();

		try {
			const folder = await ensureChatFolder(this.app, this.plugin.settings.codeFolder);
			const path = folder ? `${folder}/${fileName}` : fileName;

			if (this.codeFile && this.codeFile.path === path) {
				await this.app.vault.modify(this.codeFile, content);
			} else {
				const existing = this.app.vault.getAbstractFileByPath(path);
				if (existing instanceof TFile) {
					await this.app.vault.modify(existing, content);
					this.codeFile = existing;
				} else {
					this.codeFile = await this.app.vault.create(path, content);
				}
			}
			new Notice(`Saved "${this.codeFile.path}"`);
		} catch (err) {
			new Notice(`Could not save file: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/** Sends the current editor contents into the Chat composer as a fenced code block, ready to send. */
	private sendCodeToChat(): void {
		const code = this.codeEditor.getValue();
		if (!code.trim()) {
			new Notice("Editor is empty — nothing to send.");
			return;
		}
		const key = this.codeLanguageSelect.value as CodeLanguageKey;
		const fenceLang = key === "plaintext" ? "" : key;
		const fileName = this.codeFileNameInput.value.trim();

		const prefix = this.chatInput.value.trim() ? `${this.chatInput.value.trim()}\n\n` : "";
		this.chatInput.value = `${prefix}Here is \`${fileName}\`:\n\n\`\`\`${fenceLang}\n${code}\n\`\`\`\n\n`;
		this.setMode("chat");
		this.autoGrowChatComposer();
		this.chatInput.focus();
	}

	/** Loads a code block found in a chat/debate message into the editor, switching to the Code tab. */
	private insertCodeIntoEditor(code: string, langKey: CodeLanguageKey | null): void {
		const key = langKey ?? "plaintext";
		this.codeEditor.setValue(code);
		this.codeEditor.setLanguage(key);
		this.codeLanguageSelect.value = key;
		this.syncFileNameExtension(key);
		this.codeFile = null; // treat as a new, unsaved file rather than overwriting whatever was open
		this.setMode("code");
		new Notice("Inserted code into the editor.");
	}

	/** Adds an "Insert to editor" button under every fenced code block in a rendered markdown container. */
	private wireCodeBlockInserts(container: HTMLElement): void {
		container.querySelectorAll("pre > code").forEach((codeEl) => {
			const pre = codeEl.parentElement;
			if (!pre || pre.querySelector(".agent-swarm-insert-code-btn")) return;

			const langClass = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
			const langKey = langClass ? languageKeyFromFenceInfo(langClass.replace("language-", "")) : null;
			const code = codeEl.textContent ?? "";

			pre.addClass("agent-swarm-code-block");
			const btn = pre.createEl("button", {
				cls: "agent-swarm-insert-code-btn",
				text: "Insert to editor",
			});
			btn.addEventListener("click", () => this.insertCodeIntoEditor(code, langKey));
		});
	}

	private autoGrowComposer(): void {
		this.topicInput.style.height = "auto";
		const next = Math.min(Math.max(this.topicInput.scrollHeight, COMPOSER_MIN_HEIGHT), COMPOSER_MAX_HEIGHT);
		this.topicInput.style.height = `${next}px`;
	}

	private setSendBtnState(state: "idle" | "running" | "stopping"): void {
		this.sendBtn.removeClass("mod-cta");
		this.sendBtn.removeClass("agent-swarm-send-btn-stop");
		this.sendBtn.disabled = false;

		if (state === "idle") {
			setIcon(this.sendBtn, "arrow-up");
			this.sendBtn.addClass("mod-cta");
			this.sendBtn.setAttribute("aria-label", "Start debate");
		} else if (state === "running") {
			setIcon(this.sendBtn, "square");
			this.sendBtn.addClass("agent-swarm-send-btn-stop");
			this.sendBtn.setAttribute("aria-label", "Stop");
		} else {
			setIcon(this.sendBtn, "square");
			this.sendBtn.disabled = true;
			this.sendBtn.setAttribute("aria-label", "Stopping…");
		}
	}

	private setRunning(running: boolean): void {
		this.running = running;
		this.topicInput.disabled = running;
		this.useNoteBtn.disabled = running;
		this.setSendBtnState(running ? "running" : "idle");
	}

	private scrollToBottom(): void {
		this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
	}

	private showRetryNotice(label: string, kind: ProviderErrorKind, attempt: number): void {
		const kindLabel = kind === "rate_limit" ? "rate limited" : "server error (e.g. 503)";
		const text = `${label} hit a ${kindLabel} — retrying (attempt ${attempt})…`;
		if (this.retryStatusEl) {
			this.retryStatusEl.setText(text);
		} else {
			this.retryStatusEl = this.scrollEl.createDiv({ cls: "agent-swarm-status agent-swarm-retry-status", text });
			this.scrollToBottom();
		}
	}

	private clearRetryNotice(): void {
		this.retryStatusEl?.remove();
		this.retryStatusEl = null;
	}

	private async handleStart(): Promise<void> {
		const topic = this.topicInput.value.trim();
		if (!topic) {
			new Notice("Enter a topic or note content first.");
			return;
		}
		if (this.plugin.settings.agents.length === 0) {
			new Notice("Add at least one agent in Agent Swarm settings.");
			return;
		}

		this.scrollEl.empty();
		this.retryStatusEl = null;
		this.stopRequested = false;
		this.setRunning(true);

		this.network.build(this.plugin.settings.agents, this.plugin.settings.rounds);
		this.networkPanel.addClass("agent-swarm-network-panel-active");

		try {
			const transcript = await runDebate(
				this.app,
				this.plugin.settings,
				topic,
				(msg) => {
					this.network.setAgentDone(msg.agentId, msg.round);
					this.clearRetryNotice();
					this.renderMessage(msg);
				},
				() => this.stopRequested,
				(agentId, round) => {
					this.clearRetryNotice();
					this.network.setAgentActive(agentId, round);
				},
				(agentId, round) => {
					this.clearRetryNotice();
					this.network.setAgentError(agentId, round);
				},
				(agentId, round, attempt, kind, reason) => {
					const agent = this.plugin.settings.agents.find((a) => a.id === agentId);
					const label = agent ? `${agent.name} (round ${round})` : `Agent (round ${round})`;
					console.warn(`Agent Swarm retry — ${label}: ${reason}`);
					this.showRetryNotice(label, kind, attempt);
				},
				(change) => this.addPendingChange(change)
			);

			this.lastTopic = topic;
			this.lastTranscript = transcript;

			if (transcript.length === 0) {
				new Notice("Debate stopped before any messages were generated.");
				return;
			}

			this.clearRetryNotice();
			const statusEl = this.renderStatus("Synthesizing…");
			this.network.setSynthesisActive();
			try {
				const synthesis = await runSynthesis(this.plugin.settings, topic, transcript, (attempt, kind, reason) => {
					console.warn(`Agent Swarm retry — Synthesis: ${reason}`);
					this.showRetryNotice("Synthesis", kind, attempt);
				});
				this.lastSynthesis = synthesis;
				this.network.setSynthesisDone();
				this.clearRetryNotice();
				statusEl.remove();
				await this.renderSynthesis(synthesis);
			} catch (err) {
				this.network.setSynthesisError();
				this.clearRetryNotice();
				statusEl.remove();
				throw err;
			}
		} catch (err) {
			console.error("Agent Swarm error:", err);
			new Notice(`Agent Swarm error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this.setRunning(false);
		}
	}

	private renderStatus(text: string): HTMLElement {
		const el = this.scrollEl.createDiv({ cls: "agent-swarm-status", text });
		this.scrollToBottom();
		return el;
	}

	private renderMessage(msg: TranscriptMessage): void {
		const bubble = this.scrollEl.createDiv({ cls: "agent-swarm-message" });
		bubble.style.borderLeftColor = msg.color;

		const header = bubble.createDiv({ cls: "agent-swarm-message-header" });
		header.createSpan({ text: msg.agentName, cls: "agent-swarm-agent-name" }).style.color = msg.color;
		header.createSpan({ text: PROVIDER_LABELS[msg.provider], cls: "agent-swarm-provider-label" });
		header.createSpan({ text: `Round ${msg.round}`, cls: "agent-swarm-round-label" });

		const body = bubble.createDiv({ cls: "agent-swarm-message-body" });
		MarkdownRenderer.render(this.app, msg.content, body, "", this.plugin).then(() =>
			this.wireCodeBlockInserts(body)
		);

		this.scrollToBottom();
	}

	private async renderSynthesis(text: string): Promise<void> {
		const section = this.scrollEl.createDiv({ cls: "agent-swarm-synthesis-section" });
		section.createEl("div", { text: "Synthesis", cls: "agent-swarm-synthesis-label" });

		const contentEl = section.createDiv({ cls: "agent-swarm-synthesis-content" });
		await MarkdownRenderer.render(this.app, text, contentEl, "", this.plugin);
		this.wireCodeBlockInserts(contentEl);

		const btnRow = section.createDiv({ cls: "agent-swarm-composer-btn-row" });
		const createNoteBtn = btnRow.createEl("button", { text: "Create note", cls: "mod-cta" });
		createNoteBtn.addEventListener("click", () => this.createSynthesisNote());

		this.scrollToBottom();
	}

	private async createSynthesisNote(): Promise<void> {
		if (!this.lastSynthesis) return;

		const safeTitle = this.lastTopic
			.split("\n")[0]
			.slice(0, 60)
			.replace(/[\\/:*?"<>|#[\]^]/g, "")
			.trim() || "Agent Swarm Synthesis";

		const timestamp = window.moment().format("YYYY-MM-DD HHmm");
		const fileName = `${safeTitle} - Swarm Synthesis ${timestamp}.md`;

		const transcriptMd = this.lastTranscript
			.map((m) => `**${m.agentName}** (Round ${m.round}):\n\n${m.content}`)
			.join("\n\n---\n\n");

		const noteContent = [
			`# ${safeTitle} — Swarm Synthesis`,
			"",
			this.lastSynthesis,
			"",
			"## Full debate transcript",
			"",
			transcriptMd,
		].join("\n");

		try {
			const file = await this.app.vault.create(fileName, noteContent);
			new Notice(`Created "${file.path}"`);
			await this.app.workspace.getLeaf(true).openFile(file);
		} catch (err) {
			new Notice(`Could not create note: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	// ================= Chat mode =================

	private autoGrowChatComposer(): void {
		this.chatInput.style.height = "auto";
		const next = Math.min(Math.max(this.chatInput.scrollHeight, COMPOSER_MIN_HEIGHT), COMPOSER_MAX_HEIGHT);
		this.chatInput.style.height = `${next}px`;
	}

	private setChatRunning(running: boolean): void {
		this.chatRunning = running;
		this.chatInput.disabled = running;
		this.chatSendBtn.disabled = running;
		this.chatNewBtn.disabled = running;
		this.chatHistoryBtn.disabled = running;
		this.chatSendBtn.toggleClass("agent-swarm-send-btn-loading", running);
	}

	private chatScrollToBottom(): void {
		this.chatScrollEl.scrollTop = this.chatScrollEl.scrollHeight;
	}

	private showChatRetryNotice(kind: ProviderErrorKind, attempt: number): void {
		const kindLabel = kind === "rate_limit" ? "rate limited" : "server error (e.g. 503)";
		const text = `Assistant hit a ${kindLabel} — retrying (attempt ${attempt})…`;
		if (this.chatRetryStatusEl) {
			this.chatRetryStatusEl.setText(text);
		} else {
			this.chatRetryStatusEl = this.chatScrollEl.createDiv({
				cls: "agent-swarm-status agent-swarm-retry-status",
				text,
			});
			this.chatScrollToBottom();
		}
	}

	private clearChatRetryNotice(): void {
		this.chatRetryStatusEl?.remove();
		this.chatRetryStatusEl = null;
	}

	private renderChatMessage(msg: ChatMessage): void {
		this.chatEmptyStateEl.style.display = "none";

		const bubble = this.chatScrollEl.createDiv({
			cls: `agent-swarm-chat-message agent-swarm-chat-message-${msg.role}`,
		});

		const meta = bubble.createDiv({ cls: "agent-swarm-chat-message-meta" });
		meta.setText(msg.role === "user" ? "You" : "Assistant");

		const body = bubble.createDiv({ cls: "agent-swarm-chat-message-body" });
		MarkdownRenderer.render(this.app, msg.content, body, "", this.plugin).then(() =>
			this.wireCodeBlockInserts(body)
		);

		this.chatScrollToBottom();
	}

	private renderAllChatMessages(): void {
		this.chatScrollEl.empty();
		this.chatEmptyStateEl = this.chatScrollEl.createDiv({ cls: "agent-swarm-empty-state" });
		this.chatEmptyStateEl.createEl("div", { text: "💬", cls: "agent-swarm-empty-icon" });
		this.chatEmptyStateEl.createEl("p", {
			text:
				"Chat one-on-one with your configured assistant. Conversations are saved automatically to " +
				`"${this.plugin.settings.chatFolder || "(vault root)"}" as you go — use the history button above ` +
				"to come back to one.",
		});
		this.chatEmptyStateEl.style.display = this.chatMessages.length === 0 ? "block" : "none";

		for (const msg of this.chatMessages) this.renderChatMessage(msg);
	}

	private async handleChatSend(): Promise<void> {
		const text = this.chatInput.value.trim();
		if (!text) return;

		const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
		this.chatMessages.push(userMsg);
		this.renderChatMessage(userMsg);

		this.chatInput.value = "";
		this.autoGrowChatComposer();
		this.setChatRunning(true);

		// Persist right away so the question isn't lost even if the reply fails below.
		await this.persistChat();

		try {
			const reply = await runChatReply(this.plugin.settings, this.chatMessages, (attempt, kind) => {
				this.showChatRetryNotice(kind, attempt);
			});
			this.clearChatRetryNotice();

			const assistantMsg: ChatMessage = { role: "assistant", content: reply, timestamp: Date.now() };
			this.chatMessages.push(assistantMsg);
			this.renderChatMessage(assistantMsg);
			await this.persistChat();
		} catch (err) {
			this.clearChatRetryNotice();
			console.error("Agent Swarm chat error:", err);
			new Notice(`Chat error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this.setChatRunning(false);
			this.chatInput.focus();
		}
	}

	/** Creates the chat note on the first turn, or updates it in place on every turn after. */
	private async persistChat(): Promise<void> {
		if (this.chatMessages.length === 0) return;

		const provider = this.plugin.settings.chatProvider;
		const model = this.plugin.settings.chatModel;
		const firstUser = this.chatMessages.find((m) => m.role === "user");
		const title = titleFromFirstMessage(firstUser?.content ?? "Chat");

		try {
			if (this.chatFile) {
				const content = serializeChatNote(
					{ title, createdAt: this.chatMessages[0].timestamp, provider, model },
					this.chatMessages
				);
				await this.app.vault.modify(this.chatFile, content);
			} else {
				const folder = await ensureChatFolder(this.app, this.plugin.settings.chatFolder);
				const fileName = buildChatFileName(title);
				const path = folder ? `${folder}/${fileName}` : fileName;
				const content = serializeChatNote(
					{ title, createdAt: this.chatMessages[0].timestamp, provider, model },
					this.chatMessages
				);
				this.chatFile = await this.app.vault.create(path, content);
			}
			// Keep the "Conversations" index note in sync so every chat stays linked and
			// visible in Obsidian's graph view, and previews stay current as chats grow.
			await updateConversationsIndex(this.app, this.plugin.settings.chatFolder);
		} catch (err) {
			console.error("Agent Swarm: failed to save chat note:", err);
			new Notice(`Could not save chat note: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	private startNewChat(): void {
		if (this.chatRunning) return;
		this.chatMessages = [];
		this.chatFile = null;
		this.clearChatRetryNotice();
		this.renderAllChatMessages();
		this.chatInput.focus();
	}

	private async openChatHistory(): Promise<void> {
		if (this.chatRunning) return;
		const notes = await listChatNotes(this.app, this.plugin.settings.chatFolder);
		new ChatHistoryModal(this.app, notes, (note: ChatNoteSummary) => this.loadChatNote(note)).open();
	}

	private async loadChatNote(note: ChatNoteSummary): Promise<void> {
		try {
			const content = await this.app.vault.read(note.file);
			const messages = parseChatNote(content);
			if (!messages) {
				new Notice("Couldn't read that conversation — the note may have been edited.");
				return;
			}
			this.chatMessages = messages;
			this.chatFile = note.file;
			this.clearChatRetryNotice();
			this.renderAllChatMessages();
		} catch (err) {
			new Notice(`Could not open conversation: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
}
