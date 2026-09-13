import { AgentMessage } from "../services/types";

export class ChatHistoryStore {
  private messages: AgentMessage[] = [];

  public list(): AgentMessage[] {
    return [...this.messages];
  }

  public append(message: AgentMessage): void {
    this.messages.push(message);
  }

  public save(path: string, messages: AgentMessage[]): void {
    // placeholder for markdown or JSON note serialization
    console.log(`Saving chat history to ${path}`, messages);
  }

  public load(path: string): AgentMessage[] {
    // placeholder for markdown or JSON note parsing
    console.log(`Loading chat history from ${path}`);
    return [...this.messages];
  }
}
