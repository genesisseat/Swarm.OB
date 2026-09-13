import React, { useState } from "react";

export function ChatComposer(): JSX.Element {
  const [message, setMessage] = useState("");

  return (
    <section className="chat-composer">
      <textarea value={message} placeholder="Type a message" onChange={(event) => setMessage(event.target.value)} />
      <button className="primary-button">Send</button>
    </section>
  );
}
