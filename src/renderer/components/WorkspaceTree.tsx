import React from "react";

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: WorkspaceTreeNode[];
}

export function WorkspaceTree({ root }: { root: WorkspaceTreeNode }): JSX.Element {
  return (
    <aside className="workspace-tree">
      <div className="tree-title">Workspace</div>
      <TreeNode node={root} />
    </aside>
  );
}

function TreeNode({ node }: { node: WorkspaceTreeNode }): JSX.Element {
  return (
    <div className="tree-node">
      <span className={node.type === "folder" ? "folder-node" : "file-node"}>{node.type === "folder" ? "[folder]" : "[file]"} {node.name}</span>
      {node.children ? (
        <div className="tree-children">
          {node.children.map((child) => <TreeNode key={child.path} node={child} />)}
        </div>
      ) : null}
    </div>
  );
}
