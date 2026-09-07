import { App, PluginSettingTab, Setting } from "obsidian";
import type AgentSwarmPlugin from "./main";
import { AgentConfig, PROVIDER_LABELS, Provider } from "./types";

const ALL_PROVIDERS: Provider[] = ["anthropic", "openai", "google", "deepseek", "ollama"];

export class AgentSwarmSettingTab extends PluginSettingTab {
	plugin: AgentSwarmPlugin;

	constructor(app: App, plugin: AgentSwarmPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Agent Swarm" });
		containerEl.createEl("p", {
			text:
				"Each agent below can be wired to a different AI model. Fill in API keys for whichever " +
				"providers your agents use.",
			cls: "setting-item-description",
		});

		const gettingStarted = containerEl.createDiv({ cls: "agent-swarm-callout" });
		gettingStarted.createEl("strong", { text: "Setup order: " });
		gettingStarted.createSpan({
			text:
				"(1) paste API key(s) for each provider you plan to use, below. (2) Set how many rounds a " +
				"debate runs. (3) Check the Synthesis section — it uses its own model, separate from your " +
				"agents. (4) Configure your agent roster at the bottom — each agent picks its own provider " +
				"and persona. Then open the panel using the branching icon in the left ribbon, or run " +
				"\"Open Agent Swarm panel\" from the command palette — it has three tabs: Swarm (the debate), " +
				"Chat (a normal one-on-one assistant with saved history), and Code (a quick single-file " +
				"editor). For a full project-style editor with a file tree in its own window, use the " +
				"folder-code ribbon icon instead — it stays open alongside the main panel so you can see " +
				"Chat and the editor at once.",
		});

		const keyNote = containerEl.createDiv({ cls: "agent-swarm-callout" });
		keyNote.createEl("strong", { text: "How keys resolve: " });
		keyNote.createSpan({
			text:
				"the keys below are the shared default for each provider. Leave an agent's own " +
				"\"API key / endpoint\" field (further down, under that agent) blank and it uses these. " +
				"Fill that field in on a specific agent to pin it to its own key instead, overriding the " +
				"shared one — useful when two agents share a provider and you want them on separate quotas.",
		});

		// --- API keys & default models, per provider (always visible: different agents may use different ones) ---
		containerEl.createEl("h3", { text: "API keys & models" });
		containerEl.createEl("p", {
			text:
				"Set these once per provider. \"Default model\" is used by any agent (or the Synthesis step) " +
				"that doesn't specify its own model override.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Anthropic API key")
			.addText((t) =>
				t
					.setPlaceholder("sk-ant-...")
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (v) => {
						this.plugin.settings.anthropicApiKey = v.trim();
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Anthropic default model")
			.addText((t) =>
				t
					.setPlaceholder("claude-sonnet-4-5")
					.setValue(this.plugin.settings.anthropicModel)
					.onChange(async (v) => {
						this.plugin.settings.anthropicModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("OpenAI API key")
			.addText((t) =>
				t
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (v) => {
						this.plugin.settings.openaiApiKey = v.trim();
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("OpenAI default model")
			.addText((t) =>
				t
					.setPlaceholder("gpt-4o")
					.setValue(this.plugin.settings.openaiModel)
					.onChange(async (v) => {
						this.plugin.settings.openaiModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Google AI Studio API key(s)")
			.setDesc(
				"Create one at aistudio.google.com/apikey. You can paste multiple keys here (one per line, " +
					"or comma-separated) — calls rotate across them automatically and fail over on rate limits. " +
					"Individual agents can also be pinned to a specific key below, overriding this pool."
			)
			.addTextArea((t) => {
				t.setPlaceholder("AIza...\nAIza...")
					.setValue(this.plugin.settings.googleApiKey)
					.onChange(async (v) => {
						this.plugin.settings.googleApiKey = v;
						await this.plugin.saveSettings();
					});
				t.inputEl.rows = 3;
				t.inputEl.addClass("agent-swarm-wide-textarea");
			});
		new Setting(containerEl)
			.setName("Google default model")
			.addText((t) =>
				t
					.setPlaceholder("gemini-2.5-flash")
					.setValue(this.plugin.settings.googleModel)
					.onChange(async (v) => {
						this.plugin.settings.googleModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("DeepSeek API key")
			.setDesc("Create one at platform.deepseek.com")
			.addText((t) =>
				t
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.deepseekApiKey)
					.onChange(async (v) => {
						this.plugin.settings.deepseekApiKey = v.trim();
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("DeepSeek default model")
			.addText((t) =>
				t
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.deepseekModel)
					.onChange(async (v) => {
						this.plugin.settings.deepseekModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama base URL")
			.addText((t) =>
				t
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.ollamaBaseUrl)
					.onChange(async (v) => {
						this.plugin.settings.ollamaBaseUrl = v.trim();
						await this.plugin.saveSettings();
					})
			);
		new Setting(containerEl)
			.setName("Ollama default model")
			.addText((t) =>
				t
					.setPlaceholder("llama3")
					.setValue(this.plugin.settings.ollamaModel)
					.onChange(async (v) => {
						this.plugin.settings.ollamaModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		// --- Debate settings ---
		containerEl.createEl("h3", { text: "Debate" });

		new Setting(containerEl)
			.setName("Rounds")
			.setDesc(
				"How many times EACH agent speaks, one full pass through the agent list per round. Applies " +
					"uniformly — you can't give one agent more turns than another. Higher = longer debate, more " +
					"API calls/cost, and one more column in the live diagram. 2-3 is usually enough; debates " +
					"often stop producing new disagreement well before round 5."
			)
			.addSlider((s) =>
				s
					.setLimits(1, 5, 1)
					.setValue(this.plugin.settings.rounds)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.rounds = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include current note by default")
			.setDesc(
				"When ON: opening the swarm panel automatically fills the topic box with your currently active " +
					"note's content. When OFF: the topic box starts empty. Either way, you can always pull in the " +
					"active note manually using the paperclip button at the bottom of the panel, or type your own " +
					"topic instead."
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.includeNoteByDefault).onChange(async (v) => {
					this.plugin.settings.includeNoteByDefault = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Default provider for new agents")
			.setDesc(
				"Only affects the \"+ Add agent\" button below — new agents start pre-set to this provider " +
					"(you can change it per-agent right after adding). Does not change any existing agent."
			)
			.addDropdown((d) => {
				for (const p of ALL_PROVIDERS) d.addOption(p, PROVIDER_LABELS[p]);
				d.setValue(this.plugin.settings.defaultProvider).onChange(async (v) => {
					this.plugin.settings.defaultProvider = v as Provider;
					await this.plugin.saveSettings();
				});
			});

		// --- Normal chat ---
		containerEl.createEl("h3", { text: "Chat" });
		containerEl.createEl("p", {
			text:
				"A separate, plain one-on-one chat mode alongside the swarm — switch to it with the tab at the " +
				"top of the panel. Every conversation is auto-saved as a note in the folder below as you go, and " +
				"a \"Conversations\" index note in that same folder links to all of them, so you can browse them " +
				"in Obsidian's file explorer, graph view, or the panel's history button.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Chat provider")
			.setDesc("Which model the plain chat panel talks to.")
			.addDropdown((d) => {
				for (const p of ALL_PROVIDERS) d.addOption(p, PROVIDER_LABELS[p]);
				d.setValue(this.plugin.settings.chatProvider).onChange(async (v) => {
					this.plugin.settings.chatProvider = v as Provider;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Chat model override")
			.setDesc("Leave blank to use that provider's default model set above.")
			.addText((t) =>
				t
					.setPlaceholder("(use provider default)")
					.setValue(this.plugin.settings.chatModel)
					.onChange(async (v) => {
						this.plugin.settings.chatModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Chat system prompt")
			.addTextArea((t) => {
				t.setValue(this.plugin.settings.chatSystemPrompt).onChange(async (v) => {
					this.plugin.settings.chatSystemPrompt = v;
					await this.plugin.saveSettings();
				});
				t.inputEl.rows = 3;
				t.inputEl.addClass("agent-swarm-wide-textarea");
			});

		new Setting(containerEl)
			.setName("Chat history folder")
			.setDesc(
				"Vault-relative folder where chat conversations are saved as notes, e.g. \"Chats\" or " +
					"\"Agent Swarm/Chats\". Leave blank to save at the vault root. Created automatically the first " +
					"time it's needed."
			)
			.addText((t) =>
				t
					.setPlaceholder("Chats")
					.setValue(this.plugin.settings.chatFolder)
					.onChange(async (v) => {
						this.plugin.settings.chatFolder = v.trim();
						await this.plugin.saveSettings();
					})
			);

		// --- Code editor ---
		containerEl.createEl("h3", { text: "Code editor" });
		containerEl.createEl("p", {
			text:
				"Editing only \u2014 nothing here runs or executes code. There are two ways to use it: the Code tab " +
				"in this panel is quick single-file editing, while the standalone Code Editor (folder-code ribbon " +
				"icon, or \"Open Code Editor in a new window\" in the command palette) opens in its own OS window " +
				"with a full file-tree sidebar, so you can see it and the Chat tab at the same time. Both share " +
				"the same 13 supported languages: JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, " +
				"C/C++, Java, Rust, SQL, PHP, XML, plus plain text. Use \"Send to Chat\" / \"Insert to editor\" to " +
				"move code between the editor and an agent conversation either way.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Code files folder")
			.setDesc(
				"Vault-relative folder where files saved from the Code tab (in this panel) go, e.g. \"Code\" or " +
					"\"Agent Swarm/Code\". Leave blank to save at the vault root. Created automatically the first " +
					"time it's needed."
			)
			.addText((t) =>
				t
					.setPlaceholder("Code")
					.setValue(this.plugin.settings.codeFolder)
					.onChange(async (v) => {
						this.plugin.settings.codeFolder = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Code Editor project root")
			.setDesc(
				"Which folder the standalone Code Editor window's file tree is scoped to. Leave blank to browse " +
					"the whole vault. You can also change this from inside that window using its folder-open icon."
			)
			.addText((t) => {
				t.setPlaceholder("(vault root)")
					.setValue(this.plugin.settings.codeProjectRoot)
					.onChange(async (v) => {
						this.plugin.settings.codeProjectRoot = v.trim();
						await this.plugin.saveSettings();
					});
			});

		// --- Swarm file read/write access ---
		containerEl.createEl("h3", { text: "Swarm file access" });
		containerEl.createEl("p", {
			text:
				"Agents can list a folder's contents before reading/writing, so they don't have to guess file " +
				"names blindly on an unfamiliar or existing project.",
			cls: "setting-item-description",
		});
		const fileAccessNote = containerEl.createDiv({ cls: "agent-swarm-callout" });
		fileAccessNote.createEl("strong", { text: "Safety model: " });
		fileAccessNote.createSpan({
			text:
				"off by default. When you turn it on for a debate, agents can read files in the project folder " +
				"you choose and propose changes, but nothing is ever written automatically — every proposed " +
				"change appears in a \"Pending changes\" panel in the Swarm tab for you to Approve or Reject " +
				"individually. Only approved changes are written to disk, and every approved change is appended " +
				"to a changelog file inside the project folder so you have a full record of what was applied, " +
				"by which agent, and when.",
		});

		const coderModeNote = containerEl.createDiv({ cls: "agent-swarm-callout" });
		coderModeNote.createEl("strong", { text: "Coder Mode: " });
		coderModeNote.createSpan({
			text:
				"once file access is on, a \"Coder Mode\" checkbox appears next to it in the Swarm tab. Checking " +
				"it swaps your agent roster for a built-in Dev Team preset (Architect / Backend / Frontend / " +
				"Reviewer) — roles with non-overlapping file ownership, which matters because there's no merge " +
				"logic yet if two agents both propose writing the same file. Your own roster is snapshotted and " +
				"restored automatically when you uncheck it (or when you turn file access off entirely).",
		});

		const autopilotNote = containerEl.createDiv({ cls: "agent-swarm-callout" });
		autopilotNote.createEl("strong", { text: "Autopilot (use with caution): " });
		autopilotNote.createSpan({
			text:
				"an \"Autopilot\" checkbox also appears next to file access in the Swarm tab. Checking it (after " +
				"a confirmation prompt) skips the Pending changes review entirely — every proposed write is " +
				"applied to disk the moment an agent proposes it. Approved changes are still logged to the " +
				"changelog either way, but there's no chance to catch a bad proposal before it lands. Off by " +
				"default; turn it on only for runs where you trust the agents not to need review.",
		});

		new Setting(containerEl)
			.setName("Enable file access")
			.setDesc(
				"Master switch. Also toggleable per-session from the Swarm tab itself (checkbox above the " +
					"diagram). When off, agents are never told this capability exists at all."
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.swarmFileAccessEnabled).onChange(async (v) => {
					this.plugin.settings.swarmFileAccessEnabled = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Project folder")
			.setDesc(
				"The folder agents can read from and propose changes within. Leave blank to scope to the whole " +
					"vault (only do this if you're comfortable with agents reading/proposing changes to anything " +
					"in your vault). Also changeable from the Swarm tab's folder-open icon."
			)
			.addText((t) =>
				t
					.setPlaceholder("(vault root)")
					.setValue(this.plugin.settings.swarmProjectRoot)
					.onChange(async (v) => {
						this.plugin.settings.swarmProjectRoot = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Changelog file name")
			.setDesc("Approved changes are appended here as a table, inside the project folder above.")
			.addText((t) =>
				t
					.setPlaceholder("AGENT-CHANGES.md")
					.setValue(this.plugin.settings.swarmChangelogFile)
					.onChange(async (v) => {
						this.plugin.settings.swarmChangelogFile = v.trim() || "AGENT-CHANGES.md";
						await this.plugin.saveSettings();
					})
			);

		// --- Synthesis ---
		containerEl.createEl("h3", { text: "Synthesis" });
		containerEl.createEl("p", {
			text:
				"After the debate ends, one more model call reads the entire transcript and writes the final " +
				"note. This is completely separate from your agent roster below — it can use a different " +
				"provider/model than any of them, and only runs once per debate (so it's a reasonable place to " +
				"use your strongest/most expensive model even if your agents use cheaper ones).",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Synthesis provider")
			.setDesc("Which model reads the full transcript and writes the final note.")
			.addDropdown((d) => {
				for (const p of ALL_PROVIDERS) d.addOption(p, PROVIDER_LABELS[p]);
				d.setValue(this.plugin.settings.synthesisProvider).onChange(async (v) => {
					this.plugin.settings.synthesisProvider = v as Provider;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Synthesis model override")
			.setDesc("Leave blank to use that provider's default model set above.")
			.addText((t) =>
				t
					.setPlaceholder("(use provider default)")
					.setValue(this.plugin.settings.synthesisModel)
					.onChange(async (v) => {
						this.plugin.settings.synthesisModel = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Synthesis prompt")
			.setDesc("System prompt for the agent that writes the final synthesis note.")
			.addTextArea((t) => {
				t.setValue(this.plugin.settings.synthesisPrompt).onChange(async (v) => {
					this.plugin.settings.synthesisPrompt = v;
					await this.plugin.saveSettings();
				});
				t.inputEl.rows = 4;
				t.inputEl.addClass("agent-swarm-wide-textarea");
			});

		// --- Agent roster ---
		containerEl.createEl("h3", { text: "Agents" });
		containerEl.createEl("p", {
			text:
				"Each agent speaks once per round, in the order listed top to bottom (no reordering — remove " +
				"and re-add if you need a different order). Mix providers freely: nothing requires agents to " +
				"share a provider or model.",
			cls: "setting-item-description",
		});

		this.plugin.settings.agents.forEach((agent, index) => {
			this.renderAgentEditor(containerEl, agent, index);
		});

		new Setting(containerEl).addButton((b) =>
			b
				.setButtonText("+ Add agent")
				.setCta()
				.onClick(async () => {
					const id = `agent-${Date.now()}`;
					this.plugin.settings.agents.push({
						id,
						name: "New Agent",
						color: "#888888",
						provider: this.plugin.settings.defaultProvider,
						model: "",
						apiKeyOverride: "",
						systemPrompt: "You are a participant in a multi-agent debate. State your perspective clearly.",
					});
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	private renderAgentEditor(containerEl: HTMLElement, agent: AgentConfig, index: number): void {
		const wrapper = containerEl.createDiv({ cls: "agent-swarm-agent-editor" });

		const header = new Setting(wrapper)
			.setName(`Agent ${index + 1}`)
			.addText((t) =>
				t
					.setPlaceholder("Name")
					.setValue(agent.name)
					.onChange(async (v) => {
						agent.name = v;
						await this.plugin.saveSettings();
					})
			)
			.addColorPicker((c) =>
				c.setValue(agent.color).onChange(async (v) => {
					agent.color = v;
					await this.plugin.saveSettings();
				})
			);

		header.addExtraButton((b) =>
			b
				.setIcon("trash")
				.setTooltip("Remove agent")
				.onClick(async () => {
					this.plugin.settings.agents.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				})
		);

		new Setting(wrapper)
			.setName("Provider")
			.setDesc("Which AI service this agent calls. Each agent can use a different one.")
			.addDropdown((d) => {
				for (const p of ALL_PROVIDERS) d.addOption(p, PROVIDER_LABELS[p]);
				d.setValue(agent.provider).onChange(async (v) => {
					agent.provider = v as Provider;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(wrapper)
			.setName("Model override")
			.setDesc("Optional. Leave blank to use that provider's \"default model\" set in the section above.")
			.addText((t) =>
				t
					.setPlaceholder("(use provider default)")
					.setValue(agent.model)
					.onChange(async (v) => {
						agent.model = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(wrapper)
			.setName("API key / endpoint")
			.setDesc(
				agent.provider === "ollama"
					? "Base URL override for this agent. Leave blank to use the shared Ollama base URL above."
					: "API key override for this agent. Leave blank to use the shared key pool for this provider above — " +
							"set this to pin the agent to one specific key (useful when several agents share a provider " +
							"and you want to spread them across separate quotas)."
			)
			.addText((t) =>
				t
					.setPlaceholder(agent.provider === "ollama" ? "(use shared base URL)" : "(use shared key pool)")
					.setValue(agent.apiKeyOverride)
					.onChange(async (v) => {
						agent.apiKeyOverride = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(wrapper)
			.setName("Persona / system prompt")
			.setDesc(
				"This defines the agent's role and how it should argue. Distinct, specific personas (Skeptic, " +
					"Devil's Advocate, etc.) produce real disagreement; identical or generic prompts across " +
					"agents tend to converge on the same answer regardless of how many agents you have."
			)
			.addTextArea((t) => {
				t.setPlaceholder("System prompt / persona")
					.setValue(agent.systemPrompt)
					.onChange(async (v) => {
						agent.systemPrompt = v;
						await this.plugin.saveSettings();
					});
				t.inputEl.rows = 3;
				t.inputEl.addClass("agent-swarm-wide-textarea");
			});
	}
}
