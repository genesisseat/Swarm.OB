import React from "react";

export interface LayoutProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Layout({ title, subtitle, children }: LayoutProps): JSX.Element {
  return (
    <section className="layout-card">
      <header className="layout-header">
        <div>
          <span className="layout-kicker">Agent Swarm</span>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="layout-content">{children}</div>
    </section>
  );
}
