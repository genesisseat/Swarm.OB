import { DebateRunRequest } from "./types";

export class SwarmService {
  public async runDebate(request: DebateRunRequest): Promise<string> {
    const transcript = [
      `Topic: ${request.topic}`,
      `Agents: ${request.agents.join(", ")}`,
      `Rounds: ${request.rounds}`,
      `Provider: ${request.provider}`,
      "Debate execution placeholder",
    ];

    return transcript.join("\n");
  }
}
