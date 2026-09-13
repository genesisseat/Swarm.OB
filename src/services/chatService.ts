import { AgentMessage } from "./types";

export class ChatService {
  private messages: AgentMessage[] = [];

  public addMessage(role: AgentMessage["role"], content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  public getMessages(): AgentMessage[] {
    return [...this.messages];
  }

  public serializeMessages(): string {
    return this.messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
  }
}
