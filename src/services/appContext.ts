import { AppSettings, ProviderConnection } from "./types";
import { ProviderService } from "./providerService";
import { ChatService } from "./chatService";
import { SwarmService } from "./swarmService";
import { WorkspaceService } from "./workspaceService";

export interface AppContext {
  settings: AppSettings;
  providers: ProviderService;
  chat: ChatService;
  swarm: SwarmService;
  workspace: WorkspaceService;
}

export function createAppContext(settings: AppSettings, providers: ProviderConnection[]): AppContext {
  return {
    settings,
    providers: new ProviderService(providers),
    chat: new ChatService(),
    swarm: new SwarmService(),
    workspace: new WorkspaceService(),
  };
}
