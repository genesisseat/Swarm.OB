import { PendingFileChange } from "./types";

export class WorkspaceService {
  private pendingChanges: PendingFileChange[] = [];

  public queueChange(change: PendingFileChange): void {
    this.pendingChanges.push(change);
  }

  public getPendingChanges(): PendingFileChange[] {
    return [...this.pendingChanges];
  }

  public clearApprovedChange(id: string): void {
    this.pendingChanges = this.pendingChanges.filter((change) => change.id !== id);
  }
}
