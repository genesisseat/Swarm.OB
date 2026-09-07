export type Provider = "anthropic" | "openai" | "ollama" | "google" | "deepseek";

export interface AgentConfig {
	id: string;
	name: string;
	color: string;
	systemPrompt: string;
	/** Which AI provider this agent calls. */
	provider: Provider;
	/** Model override for this agent. Empty string = use that provider's default model from settings. */
	model: string;
	/**
	 * Per-agent API key/endpoint override. Empty string = fall back to the shared
	 * settings for this provider (which, for cloud providers, may itself be a
	 * multi-key pool that rotates). Set this when you want a specific agent pinned
	 * to a specific key — e.g. two Gemini-based agents each on their own quota.
	 * For Ollama, this field holds a base URL override instead of a key.
	 */
	apiKeyOverride: string;
}

export interface SwarmSettings {
	/** Used as the default provider/model when a new agent is added. */
	defaultProvider: Provider;

	anthropicApiKey: string;
	anthropicModel: string;

	openaiApiKey: string;
	openaiModel: string;

	ollamaBaseUrl: string;
	ollamaModel: string;

	googleApiKey: string;
	googleModel: string;

	deepseekApiKey: string;
	deepseekModel: string;

	agents: AgentConfig[];
	rounds: number;

	synthesisProvider: Provider;
	synthesisModel: string;
	synthesisPrompt: string;

	includeNoteByDefault: boolean;

	// --- Normal chat mode ---
	/** Which provider the plain chat panel uses. */
	chatProvider: Provider;
	/** Model override for chat. Empty string = use that provider's default model from settings. */
	chatModel: string;
	/** System prompt for the plain chat assistant. */
	chatSystemPrompt: string;
	/**
	 * Vault-relative folder where chat conversations are saved as notes, e.g. "Chats" or
	 * "Agent Swarm/Chats". Empty string = save at the vault root. Created automatically the
	 * first time it's needed.
	 */
	chatFolder: string;

	/** Vault-relative folder where files saved from the Code editor tab go. Empty = vault root. */
	codeFolder: string;

	/**
	 * Vault-relative folder used as the project root in the standalone Code Editor window's
	 * file tree. Empty = browse the whole vault.
	 */
	codeProjectRoot: string;

	// --- Swarm file read/write access ---
	/**
	 * Master safety switch. When false, agents are never told about file access at all —
	 * no read/write instructions are added to their prompts, regardless of swarmProjectRoot.
	 */
	swarmFileAccessEnabled: boolean;
	/** Vault-relative folder agents may read/propose writes within. Empty = not set (required to enable access). */
	swarmProjectRoot: string;
	/** Filename (within swarmProjectRoot) that approved changes get logged to. */
	swarmChangelogFile: string;
	/**
	 * When true, proposed writes are applied immediately instead of waiting in the Pending
	 * changes panel for manual approval. Off by default — this bypasses the review step you'd
	 * otherwise get, so it's a deliberate opt-in with its own confirmation, not a quiet default.
	 */
	swarmAutopilotEnabled: boolean;

	/** Whether the swarm is currently using the built-in Dev Team roster instead of the user's own agents. */
	coderModeEnabled: boolean;
	/**
	 * Snapshot of the agent roster from right before Coder Mode was switched on, so turning it
	 * back off restores exactly what was there — including any custom edits, not just a preset.
	 * Null when Coder Mode has never been used (or was already restored).
	 */
	coderModePreviousAgents: AgentConfig[] | null;
}

export interface TranscriptMessage {
	agentId: string;
	agentName: string;
	color: string;
	round: number;
	provider: Provider;
	content: string;
}

/** One turn in a normal (single-agent) chat conversation. */
export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	/** epoch ms */
	timestamp: number;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
	anthropic: "Anthropic (Claude)",
	openai: "OpenAI (GPT)",
	google: "Google AI Studio (Gemini)",
	deepseek: "DeepSeek",
	ollama: "Ollama (local)",
};

/** Returns the configured default model for a provider, used when an agent has no model override. */
export function defaultModelFor(settings: SwarmSettings, provider: Provider): string {
	switch (provider) {
		case "anthropic":
			return settings.anthropicModel;
		case "openai":
			return settings.openaiModel;
		case "google":
			return settings.googleModel;
		case "deepseek":
			return settings.deepseekModel;
		case "ollama":
			return settings.ollamaModel;
	}
}

export const DEFAULT_SETTINGS: SwarmSettings = {
	defaultProvider: "anthropic",

	anthropicApiKey: "",
	anthropicModel: "claude-sonnet-4-5",

	openaiApiKey: "",
	openaiModel: "gpt-4o",

	ollamaBaseUrl: "http://localhost:11434",
	ollamaModel: "llama3",

	googleApiKey: "",
	googleModel: "gemini-2.5-flash",

	deepseekApiKey: "",
	deepseekModel: "deepseek-chat",

	agents: [
		{
			id: "advocate",
			name: "Advocate",
			color: "#4f9dde",
			provider: "anthropic",
			model: "",
			apiKeyOverride: "",
			systemPrompt:
				"You are the Advocate in a multi-agent debate inside a note-taking app. " +
				"You argue persuasively FOR the strongest version of the topic under discussion. " +
				"Be specific, cite reasoning, and directly engage with what other agents have said. " +
				"If you notice other agents converging on your position, do not treat that as confirmation — " +
				"restate your strongest argument in a new way and actively look for the best remaining objection " +
				"to it yourself, rather than letting agreement go unexamined. Only change your position when an " +
				"argument actually defeats yours point by point, and say explicitly when that happens. " +
				"Keep responses to 2-4 short paragraphs.",
		},
		{
			id: "skeptic",
			name: "Skeptic",
			color: "#e0674f",
			provider: "openai",
			model: "",
			apiKeyOverride: "",
			systemPrompt:
				"You are the Skeptic in a multi-agent debate inside a note-taking app. " +
				"You probe for weaknesses, missing evidence, and unstated assumptions in the topic and in what " +
				"other agents have said. Be rigorous but fair, not contrarian for its own sake. " +
				"If most other agents start agreeing with each other, treat that as a signal to look harder, not " +
				"a signal to relax — early agreement is often anchoring on whoever spoke first, not evidence of " +
				"correctness. Name specifically what would have to be true for the emerging consensus to be wrong. " +
				"Keep responses to 2-4 short paragraphs.",
		},
		{
			id: "wildcard",
			name: "Wildcard",
			color: "#9b59d0",
			provider: "google",
			model: "",
			apiKeyOverride: "",
			systemPrompt:
				"You are the Wildcard in a multi-agent debate inside a note-taking app. " +
				"You bring in unexpected angles, analogies, adjacent fields, or reframings that the other agents " +
				"are missing. You are not bound to agree or disagree with anyone. " +
				"Your specific job in later rounds: watch for the group converging on a single answer, and treat " +
				"that convergence itself as suspicious rather than reassuring. When you see it happening, actively " +
				"construct the strongest serious case against the emerging consensus — not a token objection, a " +
				"real one — even if it isn't the position you'd personally bet on. A debate that ends in quick " +
				"unanimity has usually failed to surface something. " +
				"Keep responses to 2-4 short paragraphs.",
		},
		{
			id: "analyst",
			name: "Analyst",
			color: "#4fbf7f",
			provider: "deepseek",
			model: "",
			apiKeyOverride: "",
			systemPrompt:
				"You are the Analyst in a multi-agent debate inside a note-taking app. " +
				"You stay close to the concrete facts and numbers given in the topic. You clearly separate what is " +
				"stated/precise from what you are estimating or inferring, and you flag when a claim (yours or " +
				"another agent's) isn't actually supported by the data provided. You are not a calculator and " +
				"cannot verify numbers beyond what's in the transcript, but you hold everyone to that standard. " +
				"You also watch for anchoring: if several agents converge on the same answer, check whether they're " +
				"independently supported by the evidence or just repeating the first strong argument made — call " +
				"out anchoring explicitly if you see it, the same way you'd flag an unsupported number. " +
				"Keep responses to 2-4 short paragraphs.",
		},
	],
	rounds: 2,

	synthesisProvider: "anthropic",
	synthesisModel: "",
	synthesisPrompt:
		"You are the Synthesizer. Read the full debate transcript below and produce a well-organized markdown " +
		"note that captures the strongest points from each perspective, notes remaining disagreements, and ends " +
		"with a short 'Key Takeaways' bullet list. Do not simply summarize turn-by-turn; synthesize into a " +
		"coherent whole. Use markdown headings. If the agents converged on a single answer, briefly assess " +
		"whether that agreement looks independently earned (each agent reached it via different reasoning) or " +
		"anchored (later agents mostly restated the first strong argument without adding independent support) " +
		"— this matters for how much weight the reader should put on the consensus.",

	includeNoteByDefault: true,

	chatProvider: "anthropic",
	chatModel: "",
	chatSystemPrompt:
		"You are a helpful, concise assistant chatting with the user inside their Obsidian vault. " +
		"Use markdown formatting where it helps readability.",
	chatFolder: "Chats",

	codeFolder: "Code",

	codeProjectRoot: "",

	swarmFileAccessEnabled: false,
	swarmProjectRoot: "",
	swarmChangelogFile: "AGENT-CHANGES.md",
	swarmAutopilotEnabled: false,

	coderModeEnabled: false,
	coderModePreviousAgents: null,
};
