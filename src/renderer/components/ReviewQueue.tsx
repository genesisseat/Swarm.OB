import React from "react";

export interface PendingReviewItem {
  id: string;
  file: string;
  summary: string;
}

export function ReviewQueue({ items }: { items: PendingReviewItem[] }): JSX.Element {
  return (
    <section className="review-queue">
      <div className="queue-title">Pending changes</div>
      {items.length === 0 ? <p>No pending changes</p> : null}
      {items.map((item) => (
        <article className="review-row" key={item.id}>
          <span className="review-file">{item.file}</span>
          <span className="review-summary">{item.summary}</span>
          <div className="review-actions">
            <button>Approve</button>
            <button>Reject</button>
          </div>
        </article>
      ))}
    </section>
  );
}
