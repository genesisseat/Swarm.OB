import React from "react";

export function ReviewView(): JSX.Element {
  return (
    <section className="view-card">
      <h2>Review Queue</h2>
      <p>Approve or reject proposed file edits before they are written.</p>
      <ul className="review-list">
        <li><span>src/example.ts</span><button>Approve</button><button>Reject</button></li>
      </ul>
    </section>
  );
}
