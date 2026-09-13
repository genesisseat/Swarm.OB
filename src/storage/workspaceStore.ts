import { WorkspaceTreeNode } from "../renderer/components/WorkspaceTree";

export class WorkspaceStore {
  public scan(root: string): WorkspaceTreeNode {
    return {
      name: root.replace(/\\/g, "/").split("/").pop() || "workspace",
      path: root,
      type: "folder",
      children: [
        { name: "src", path: `${root}/src`, type: "folder" },
        { name: "README.md", path: `${root}/README.md`, type: "file" },
      ],
    };
  }
}
