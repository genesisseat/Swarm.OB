import React, { useState } from "react";

export function NoteEditor(): JSX.Element {
  const [title, setTitle] = useState("Untitled Note");
  const [content, setContent] = useState("# Agent Swarm\n\nWelcome to the standalone note workspace.");

  return (
    <section className="note-editor">
      <input className="note-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea className="note-content" value={content} onChange={(event) => setContent(event.target.value)} />
      <button className="primary-button">Save Note</button>
    </section>
  );
}
