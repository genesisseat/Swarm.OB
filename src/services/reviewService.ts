import { PendingFileChange } from "./types";

export class ReviewService {
  private queue: PendingFileChange[] = [];

  public add(change: PendingFileChange): void {
    this.queue.push(change);
  }

  public list(): PendingFileChange[] {
    return [...this.queue];
  }

  public approve(id: string): PendingFileChange | undefined {
    const found = this.queue.find((change) => change.id === id);
    this.queue = this.queue.filter((change) => change.id !== id);
    return found;
  }

  public reject(id: string): void {
    this.queue = this.queue.filter((change) => change.id !== id);
  }
}
