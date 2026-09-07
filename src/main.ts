import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, SwarmSettings } from "./types";
import { AgentSwarmSettingTab } from "./settings";
import { AgentSwarmView, VIEW_TYPE_AGENT_SWARM } from "./view";
import { CodeEditorView, VIEW_TYPE_CODE_EDITOR } from "./codeEditorView";

export default class AgentSwarmPlugin extends Plugin {
	settings!: SwarmSettings;

	private saveDebounceHandle: number | null = null;
	private pendingSaveResolvers: Array<() => void> = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_AGENT_SWARM, (leaf) => new AgentSwarmView(leaf, this));
		this.registerView(VIEW_TYPE_CODE_EDITOR, (leaf) => new CodeEditorView(leaf, this));

		this.addRibbonIcon("users", "Open Agent Swarm", () => {
			this.activateView();
		});

		this.addRibbonIcon("folder-code", "Open Code Editor (new window)", () => {
			this.activateCodeEditorWindow();
		});

		this.addCommand({
			id: "open-agent-swarm",
			name: "Open Agent Swarm panel",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "open-code-editor-window",
			name: "Open Code Editor in a new window",
			callback: () => this.activateCodeEditorWindow(),
		});

		this.addSettingTab(new AgentSwarmSettingTab(this.app, this));
	}

	onunload(): void {
		// Flush any pending debounced save immediately rather than losing it to the 250ms window.
		if (this.saveDebounceHandle !== null) {
			window.clearTimeout(this.saveDebounceHandle);
			this.saveDebounceHandle = null;
			this.saveData(this.settings);
			this.pendingSaveResolvers = [];
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_AGENT_SWARM);

		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_AGENT_SWARM, active: true });
		}

		if (leaf) workspace.revealLeaf(leaf);
	}

	/**
	 * Opens the standalone Code Editor in its own OS window (via Obsidian's native popout
	 * support), so it can sit alongside the main window's Chat/Swarm panel instead of
	 * competing with it for space.
	 */
	async activateCodeEditorWindow(): Promise<void> {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_CODE_EDITOR);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.openPopoutLeaf();
		await leaf.setViewState({ type: VIEW_TYPE_CODE_EDITOR, active: true });
		workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Debounced save: `this.settings` (in memory) is always updated instantly by callers before
	 * they call this, so nothing is ever lost from the UI's perspective. What this debounces is
	 * the actual disk write — settings text fields (like API keys) fire onChange on every
	 * keystroke, and without this, rapid typing could queue up several overlapping, unawaited
	 * saveData() calls with no guaranteed completion order. A stale, partially-typed value
	 * finishing its write *after* the final correct one would silently overwrite it on disk —
	 * a real "my edit got reverted" bug. Coalescing rapid calls into a single write after
	 * typing settles removes that race entirely, and every caller still gets a promise that
	 * resolves once the (single, final) write actually completes.
	 */
	async saveSettings(): Promise<void> {
		return new Promise((resolve) => {
			this.pendingSaveResolvers.push(resolve);
			if (this.saveDebounceHandle !== null) {
				window.clearTimeout(this.saveDebounceHandle);
			}
			this.saveDebounceHandle = window.setTimeout(async () => {
				this.saveDebounceHandle = null;
				await this.saveData(this.settings);
				const resolvers = this.pendingSaveResolvers;
				this.pendingSaveResolvers = [];
				resolvers.forEach((r) => r());
			}, 250);
		});
	}
}
