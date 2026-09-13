export type AppMode = "swarm" | "chat" | "code" | "review";

export interface AppSettings {
  providerApiKeys: Record<string, string>;
  workspaceRoot: string;
  coderMode: boolean;
  autopilot: boolean;
  selectedMode: AppMode;
}

export interface ProviderConnection {
  provider: string;
  model: string;
  endpoint?: string;
}

export interface WorkspaceFile {
  path: string;
  isDirectory: boolean;
  modifiedAt?: number;
}

export interface PendingChange {
  id: string;
  targetPath: string;
  previousContent?: string;
  proposedContent: string;
  agentName: string;
  createdAt: number;
}

export class StandaloneAppRuntime {
  public settings: AppSettings;
  public providers: ProviderConnection[];

  constructor(settings: AppSettings, providers: ProviderConnection[]) {
    this.settings = settings;
    this.providers = providers;
  }

  public getSelectedMode(): AppMode {
    return this.settings.selectedMode;
  }

  public registerProvider(connection: ProviderConnection): void {
    this.providers.push(connection);
  }

  public listWorkspaceFiles(root: string): WorkspaceFile[] {
    return [];
  }

  public queuePendingChange(change: PendingChange): void {
    // Placeholder for future UI review queue integration.
  }
}

export interface AppServiceRegistry {
  settingsStore: string;
  providerService: string;
  chatHistoryStore: string;
  fileReviewService: string;
  agentOrchestrator: string;
}

export const serviceRegistrySeed: AppServiceRegistry = {
  settingsStore: "settings-store",
  providerService: "provider-dispatcher",
  chatHistoryStore: "chat-notes-store",
  fileReviewService: "review-queue",
  agentOrchestrator: "swarm-orchestrator",
};
