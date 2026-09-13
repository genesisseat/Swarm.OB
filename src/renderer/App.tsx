import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SwarmView } from "./views/SwarmView";
import { ChatView } from "./views/ChatView";
import { EditorView } from "./views/EditorView";
import { ReviewView } from "./views/ReviewView";
import { WorkspaceTree } from "./components/WorkspaceTree";
import { Layout } from "./components/Layout";
import { ReviewQueue } from "./components/ReviewQueue";
import { ChatComposer } from "./components/ChatComposer";
import { NoteEditor } from "./components/NoteEditor";

const treeRoot = {
  name: "workspace",
  path: "/workspace",
  type: "folder" as const,
  children: [
    { name: "src", path: "/workspace/src", type: "folder" as const },
    { name: "README.md", path: "/workspace/README.md", type: "file" as const },
  ],
};

const App = () => {
  const [activeView, setActiveView] = useState<"swarm" | "chat" | "code" | "review" | "note">("swarm");

  return (
    <main className="obsidian-screenshot-shell">
      <aside className="icon-rail">
        <div className="icon-brand">✦</div>
        <div className="icon-row">
          <button className="icon-button active">☰</button>
          <button className="icon-button">⌕</button>
          <button className="icon-button">✎</button>
          <button className="icon-button">☄</button>
        </div>
      </aside>

      <aside className="folder-panel">
        <div className="folder-panel-title">Workspace</div>
        <div className="folder-list">
          <div className="folder-row"><span className="folder-label">Attachments</span><span className="folder-count">0</span></div>
          <div className="folder-row"><span className="folder-label">Chats</span><span className="folder-count">21</span></div>
          <div className="folder-row"><span className="folder-label">Code</span><span className="folder-count">0</span></div>
          <div className="folder-row"><span className="folder-label">Notes</span><span className="folder-count">1</span></div>
        </div>
        <div className="workspace-tree-wrap">
          <WorkspaceTree root={treeRoot} />
        </div>
      </aside>

      <section className="main-panel">
        <header className="tab-strip">
          <button className="tab-button active">New tab</button>
          <button className="tab-button">+</button>
        </header>

        <section className="content-stage">
          {activeView === "swarm" && (
            <Layout title="Swarm" subtitle="Debate a topic and synthesize a result">
              <SwarmView />
            </Layout>
          )}
          {activeView === "chat" && (
            <Layout title="Chat" subtitle="Conversation with the assistant">
              <ChatView />
              <ChatComposer />
            </Layout>
          )}
          {activeView === "code" && (
            <Layout title="Code Editor" subtitle="Workspace-aware source editor">
              <EditorView />
            </Layout>
          )}
          {activeView === "review" && (
            <Layout title="Review Queue" subtitle="Approve or reject proposed file changes">
              <ReviewView />
              <ReviewQueue items={[{ id: "1", file: "src/example.ts", summary: "Create file review placeholder" }]} />
            </Layout>
          )}
          {activeView === "note" && (
            <Layout title="Notes" subtitle="Markdown notes workspace">
              <NoteEditor />
            </Layout>
          )}
        </section>
      </section>

      <aside className="agent-panel">
        <header className="agent-panel-title">
          <span>Agent Swarm</span>
        </header>
        <nav className="agent-mode-tabs">
          <button className={activeView === "swarm" ? "active" : ""} onClick={() => setActiveView("swarm")}>Swarm</button>
          <button className={activeView === "chat" ? "active" : ""} onClick={() => setActiveView("chat")}>Chat</button>
          <button className={activeView === "code" ? "active" : ""} onClick={() => setActiveView("code")}>Code</button>
          <button className={activeView === "review" ? "active" : ""} onClick={() => setActiveView("review")}>Review</button>
          <button className={activeView === "note" ? "active" : ""} onClick={() => setActiveView("note")}>Notes</button>
        </nav>
        <section className="agent-grid">
          <div className="agent-grid-row">
            <span className="agent-node node-red" />
            <span className="agent-node node-green" />
            <span className="agent-node node-blue" />
          </div>
          <div className="agent-grid-row">
            <span className="agent-node node-yellow" />
            <span className="agent-node node-purple" />
            <span className="agent-node node-orange" />
          </div>
        </section>
        <section className="agent-output">
          <div className="output-title">Phase-Gated Discovery</div>
          <div className="output-text">
            <p>AST nodes: 5</p>
            <p>Reviewing file changes and review decisions.</p>
          </div>
        </section>
      </aside>
    </main>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
