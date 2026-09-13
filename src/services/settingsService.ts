import { AppSettings } from "./types";

export class SettingsService {
  private settings: AppSettings = {
    providerApiKeys: {
      anthropic: "",
      openai: "",
      google: "AQ.Ab8RN6J6nDpkQ1MmAQT_n2webhwtom1Z0mUuEU-XkjOugvYsKw",
      deepseek: "",
      ollama: "http://localhost:11434",
    },
    workspaceRoot: "Code",
    coderMode: false,
    autopilot: false,
    selectedMode: "swarm",
    agents: [],
    rounds: 5,
    synthesisProvider: "google",
    synthesisModel: "gemini-3.6-flash",
    synthesisPrompt: "You are the Synthesizer. Read the full debate transcript below and produce a well-organized markdown note that captures the strongest points from each perspective, notes remaining disagreements, and ends with a short 'Key Takeaways' bullet list. Do not simply summarize turn-by-turn; synthesize into a coherent whole. Use markdown headings.",
    chatProvider: "google",
    chatModel: "gemini-3.1-flash-lite",
    chatSystemPrompt: "You are a helpful, concise assistant chatting with the user inside their Obsidian vault. Use markdown formatting where it helps readability.",
    chatFolder: "Chats",
    codeFolder: "Code",
    codeProjectRoot: "Code",
    swarmFileAccessEnabled: false,
    swarmProjectRoot: "TwoSips",
    swarmChangelogFile: "AGENT-CHANGES.md",
    swarmAutopilotEnabled: false,
    defaultProvider: "google",
    provider: "google",
  };

  public load(): AppSettings {
    return this.settings;
  }

  public save(next: AppSettings): void {
    this.settings = next;
  }
}
