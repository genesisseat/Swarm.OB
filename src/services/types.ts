export type ProviderId = "anthropic" | "openai" | "google" | "deepseek" | "ollama";

export interface ProviderConnection {
  provider: ProviderId;
  model: string;
  endpoint?: string;
  apiKey?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  color: string;
  provider: ProviderId;
  model: string;
  apiKeyOverride: string;
  systemPrompt: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface DebateRunRequest {
  topic: string;
  agents: string[];
  rounds: number;
  provider: ProviderId;
}

export interface PendingFileChange {
  id: string;
  targetPath: string;
  previousContent?: string;
  proposedContent: string;
  agentName: string;
  createdAt: number;
}

export interface AppSettings {
  providerApiKeys: Record<string, string>;
  workspaceRoot: string;
  coderMode: boolean;
  autopilot: boolean;
  selectedMode: "swarm" | "chat" | "code" | "review";
  agents: AgentConfig[];
  rounds: number;
  synthesisProvider: ProviderId;
  synthesisModel: string;
  synthesisPrompt: string;
  chatProvider: ProviderId;
  chatModel: string;
  chatSystemPrompt: string;
  chatFolder: string;
  codeFolder: string;
  codeProjectRoot: string;
  swarmFileAccessEnabled: boolean;
  swarmProjectRoot: string;
  swarmChangelogFile: string;
  swarmAutopilotEnabled: boolean;
  defaultProvider: ProviderId;
  provider: ProviderId;
}
