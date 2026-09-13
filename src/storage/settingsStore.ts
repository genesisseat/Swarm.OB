import settingsData from "../../data.json";
import { AppSettings, ProviderId } from "../services/types";

export class SettingsStore {
  private settings: AppSettings = this.createFromData(settingsData as any);

  private createFromData(data: any): AppSettings {
    return {
      providerApiKeys: {
        anthropic: data.anthropicApiKey ?? "",
        openai: data.openaiApiKey ?? "",
        google: data.googleApiKey ?? "",
        deepseek: data.deepseekApiKey ?? "",
        ollama: data.ollamaBaseUrl ?? "",
      },
      workspaceRoot: data.codeProjectRoot ?? "",
      coderMode: Boolean(data.coderModeEnabled),
      autopilot: Boolean(data.swarmAutopilotEnabled),
      selectedMode: "swarm",
      agents: data.agents ?? [],
      rounds: Number(data.rounds ?? 5),
      synthesisProvider: data.synthesisProvider ?? "google",
      synthesisModel: data.synthesisModel ?? "gemini-3.6-flash",
      synthesisPrompt: data.synthesisPrompt ?? "",
      chatProvider: data.chatProvider ?? "google",
      chatModel: data.chatModel ?? "gemini-3.1-flash-lite",
      chatSystemPrompt: data.chatSystemPrompt ?? "",
      chatFolder: data.chatFolder ?? "Chats",
      codeFolder: data.codeFolder ?? "Code",
      codeProjectRoot: data.codeProjectRoot ?? "Code",
      swarmFileAccessEnabled: Boolean(data.swarmFileAccessEnabled),
      swarmProjectRoot: data.swarmProjectRoot ?? "",
      swarmChangelogFile: data.swarmChangelogFile ?? "AGENT-CHANGES.md",
      swarmAutopilotEnabled: Boolean(data.swarmAutopilotEnabled),
      defaultProvider: data.defaultProvider ?? "google",
      provider: data.provider ?? "google",
    };
  }

  public load(): AppSettings {
    return {
      ...this.settings,
      providerApiKeys: { ...this.settings.providerApiKeys },
      agents: this.settings.agents.map((agent) => ({ ...agent })),
    };
  }

  public save(next: AppSettings): void {
    this.settings = {
      ...next,
      providerApiKeys: { ...next.providerApiKeys },
      agents: next.agents.map((agent) => ({ ...agent })),
    };
  }

  public setWorkspaceRoot(root: string): void {
    this.settings.workspaceRoot = root;
  }
}
