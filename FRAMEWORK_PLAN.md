# Framework Planning for a Standalone App

## Recommendation

Use a desktop application framework based on Electron, a React interface layer, and the existing TypeScript business logic extracted from the current Obsidian plugin.

This is the best fit because the repository already has:

- TypeScript source structure
- esbuild bundling
- CodeMirror integration for code editing
- file and folder review workflows
- provider abstraction for multiple LLM APIs

Electron gives us direct file-system access and an OS-window model that aligns with the repository’s current separate code editor popout behavior.

## Proposed Framework Stack

```text
Electron + React + TypeScript + esbuild + CodeMirror
```

### Why this stack

- Electron is a strong fit because the existing product already behaves like a desktop application and is designed around Obsidian views and popout windows.
- React is a natural migration layer for replacing the current Obsidian UI view templates with a reusable app interface.
- TypeScript preserves the codebase’s existing style and lets us keep the existing provider, swarm, chat, and file-safety abstractions.
- CodeMirror remains useful for the editor experience and can be wrapped behind an Electron-safe file service.

## Application Architecture

```text
Desktop app shell
    ├── Electron main process
    │   └── file, window, storage, process orchestration
    ├── React renderer
    │   └── Swarm, Chat, Editor, Review UI
    └── TypeScript core services
        ├── providers
        ├── swarm
        ├── chat
        ├── file safety
        └── settings and workspace storage
```

## Target Folder Structure

```text
src/
  app/
    main.ts                 # Electron main process
    preload.ts              # Electron preload bridge
  renderer/
    App.tsx                 # Root app layout
    views/
      SwarmView.tsx         # Debate / synthesis workspace
      ChatView.tsx          # 1:1 chat workspace
      EditorView.tsx        # Code editor workspace
      ReviewView.tsx        # File review queue
    components/
    styles/
  services/
    providers/
    swarm/
    chat/
    files/
    storage/
  shared/
    types.ts
    constants.ts
```

## Migration Order

### Step 1 — Framework Selection

Create a framework decision record that states:

- desktop runtime: Electron
- UI runtime: React
- language: TypeScript
- build tooling: esbuild
- editor engine: CodeMirror

This should become the default runtime shape for the standalone product.

### Step 2 — Introduce an App Shell

Create a minimal Electron shell that can:

- start the React renderer,
- expose a local workspace directory,
- serve provider and chat service hooks through a preload bridge,
- create a native desktop window.

### Step 3 — Extract Core Logic from Obsidian

Refactor the current module boundaries into reusable service classes:

- `ProviderService`
- `SwarmService`
- `ChatService`
- `FileAccessService`
- `SettingsService`
- `StorageService`

These services should receive interface-based dependency injection instead of an Obsidian plugin object.

### Step 4 — Build the React UI

Use React to implement:

- left navigation or tabs
- main workspace render area
- chat composer and transcript area
- file tree and editor view
- review queue for pending file changes

### Step 5 — Replace Obsidian Storage APIs

The app should use:

- JSON settings store
- folder-based chat note store
- project workspace directory scanning
- markdown change log

### Step 6 — Package and Distribute

Use Electron packaging to produce a cross-platform standalone app.

## Recommended Design Constraints

- Keep provider adapters provider-neutral and retry-aware.
- Treat all file writes as reviewable proposals unless user explicitly enables autopilot.
- Keep a strict root workspace path and reject absolute or traversal paths.
- Keep UI state separated from provider service state.
- Treat the chat history and synthesis notes as plain markdown files.

## Out-of-Scope for First Version

- cloud sync
- multi-user collaboration
- real-time shared editing
- remote model gateway
- advanced plugin ecosystem integration

## Risks and Mitigations

### Risk: workflow logic is too tightly coupled to Obsidian

Mitigation: extract all provider, file, and swarm logic behind pure TypeScript services that receive an app context rather than a plugin object.

### Risk: UI complexity becomes hard to maintain

Mitigation: implement a React view layer with smaller reusable components and a deterministic service API.

### Risk: file-safety checks become too permissive

Mitigation: ensure the app root and all file proposals pass through a strict path validator before any write is considered.

## Final Decision

Choose Electron + React + TypeScript + CodeMirror as the framework for the independent app.

That allows the project to carry forward its current identity as an intelligent workspace for multi-agent reasoning, file-aware editing, and generated conversation notes while removing the direct Obsidian dependency.
