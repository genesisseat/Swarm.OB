# Swarm.OB

Agent Swarm is an Obsidian plugin for multi-agent debates, AI chat, synthesis notes, and vault-based code editing.

## Features

- Configurable AI agents with Anthropic, OpenAI, Google AI Studio, DeepSeek, and Ollama.
- Multi-round debates with live network visualization and final synthesis.
- One-to-one chat with automatically saved Markdown conversations.
- Inline and standalone CodeMirror editors for common programming languages.
- Optional project-folder file access with path safety checks, reviewable changes, and changelog logging.
- Coder Mode with Architect, Backend, Frontend, and Reviewer agents.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development build watcher:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

The plugin entry point is `src/main.ts`. The generated Obsidian bundle is `main.js`; edit the TypeScript source instead of editing the bundle directly.

## Documentation

- [Project documentation](PROJECT_DOCUMENTATION.md) - architecture, setup, build process, runtime flows, provider behavior, storage, file-access safety, and design constraints.
- [Source function reference](src/README.md) - detailed responsibilities for every source module and its functions/classes.

## Project Layout

```text
Swarm.OB/
├── src/                    TypeScript source code
├── main.js                 Generated Obsidian bundle
├── manifest.json           Obsidian plugin metadata
├── styles.css              Plugin UI styles
├── package.json            Dependencies and build scripts
├── tsconfig.json           TypeScript configuration
└── PROJECT_DOCUMENTATION.md
```

## Safety Notes

Agent file access is disabled by default. When enabled, agents can read files and propose complete file replacements, but changes normally require manual approval before being written. Autopilot is an explicit opt-in mode that skips this review step.
