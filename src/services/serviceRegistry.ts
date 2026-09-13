export type AppServiceName =
  | "settingsStore"
  | "providerService"
  | "chatHistoryStore"
  | "fileReviewService"
  | "agentOrchestrator"
  | "workspaceService";

export interface ServiceDescriptor {
  name: AppServiceName;
  version: string;
  status: "planned" | "implemented" | "wired";
  module: string;
}

export interface AppServiceRegistry {
  services: Record<AppServiceName, ServiceDescriptor>;
}

export const appServiceRegistry: AppServiceRegistry = {
  services: {
    settingsStore: {
      name: "settingsStore",
      version: "0.1.0",
      status: "planned",
      module: "storage/settings-store",
    },
    providerService: {
      name: "providerService",
      version: "0.1.0",
      status: "planned",
      module: "services/providers/provider-service",
    },
    chatHistoryStore: {
      name: "chatHistoryStore",
      version: "0.1.0",
      status: "planned",
      module: "storage/chat-history-store",
    },
    fileReviewService: {
      name: "fileReviewService",
      version: "0.1.0",
      status: "planned",
      module: "services/files/review-service",
    },
    agentOrchestrator: {
      name: "agentOrchestrator",
      version: "0.1.0",
      status: "planned",
      module: "services/swarm/orchestrator",
    },
    workspaceService: {
      name: "workspaceService",
      version: "0.1.0",
      status: "planned",
      module: "services/files/workspace-service",
    },
  },
};
