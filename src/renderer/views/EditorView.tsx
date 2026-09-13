import React from "react";

export function EditorView(): JSX.Element {
  return (
    <section className="view-card">
      <h2>Code Editor</h2>
      <p>Workspace editor and file-tree view for project-aware editing.</p>
      <div className="code-editor-placeholder">Editor</div>
    </section>
  );
}
