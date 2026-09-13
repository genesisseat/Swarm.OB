import React from "react";

export function ChatView(): JSX.Element {
  return (
    <section className="view-card">
      <h2>Chat</h2>
      <p>One-to-one assistant conversation with saved markdown history.</p>
      <textarea placeholder="Ask the assistant..." />
      <button className="primary-button">Send</button>
    </section>
  );
}
