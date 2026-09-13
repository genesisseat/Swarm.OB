# Standalone App TODO

## Repository Origin

- [x] Confirm that the workspace is a clone of the original Obsidian extension repository at https://github.com/genesisseat/Swarm.OB.
- [x] Treat the standalone desktop build as a migration of the original extension into an independent electron-first app.

## Framework

- [x] Confirm the standalone desktop framework stack: Electron + React + TypeScript + esbuild + CodeMirror.
- [x] Create a desktop app shell with a single top-level window and app layout.
- [x] Add an Electron main process and preload bridge file.
- [x] Add a React renderer entrypoint and app layout shell.

## Core App Architecture

- [x] Extract the provider service interface from the current provider code.
- [x] Extract the swarm orchestration service from the current swarm code.
- [x] Extract the chat history and save/load service from the current chat store code.
- [x] Extract file read/list/write and review safety logic from the current file operation code.
- [x] Replace Obsidian plugin runtime references with an application context object.

## UI Migration

- [x] Port the Swarm tab experience into an app view.
- [x] Port the Chat tab experience into an app view.
- [x] Port the Code editor experience into an app editor workspace.
- [x] Port the pending review/change queue into a file approval UI.
- [x] Add workspace tree navigation and folder scanning.
- [x] Add a note-first markdown editor panel and note service abstraction.
- [x] Add a Notes navigation entry for the standalone renderer view.
- [x] Create a prototype screenshot-inspired interface: icon rail, folder tree, central tab content area, and right-side agent panel.

## Prototype Workstream

- [ ] Hook workspace tree, note editor, and review queue to local storage services.
- [ ] Wire note save/load flows into the markdown file store.
- [ ] Add markdown preview mode and a stronger note metadata drawer.
- [ ] Connect UI views to provider, chat, swarm, and review services through the service registry.
- [ ] Add automated UI smoke expectations for the prototype layout and note-first rendering path.

## Data Settings and Config

- [x] Load the existing six-agent plus one-synthesis configuration from the workspace data file.
- [x] Align the standalone app setting service model with the JSON-backed data schema.
- [x] Enable the TypeScript JSON import path needed for the data-backed settings store.
- [ ] Add a regression test that asserts the data.json-backed settings model initializes six agents and one synthesis provider.

## Interface Testing Requirement

- [ ] Add an interface test path that renders and exercises the `Swarm` debate mode using the shared six-agent data config.
- [ ] Add an interface test path that renders and exercises the normal `Chat` mode using the shared chat provider/model config.
- [ ] Add a smoke check that verifies the UI can switch between the provider-backed chat and six-agent swarm configuration without the interface crashing.

## Basic Modules to Implement First

- [ ] Implement settings and workspace persistence service.
- [ ] Implement workspace scanning and folder/file tree service.
- [ ] Implement local markdown chat and note store.
- [ ] Implement local review queue and change approval service.
- [ ] Implement provider registry and basic agent service wiring.

## Original Swarm Reuse Review

- [x] Preserve the original round-based transcript flow and agent-order review pattern from the existing `runDebate()` structure.
- [x] Preserve provider dispatch and token-limit retry behavior from `providers.ts` and `swarm.ts` in the standalone service abstraction.
- [x] Preserve file-read/list/write extraction and pending-change review object creation as the review-safe write model for the independent app.
- [ ] Port the original code into reusable service classes without keeping Obsidian-specific runtime hooks.

## Architecture Guardrail

- [ ] Keep the original `runDebate()` / `runSynthesis()` architecture as the logic model for the standalone app.
- [ ] Keep the provider dispatch and error-classification source of truth in the provider adapter service.
- [ ] Keep file-safe request parsing and `PendingChange` creation as the review queue contract.
- [ ] Adapt only the renderer shell and layout mapping around the existing services without changing the swarm execution semantics.

## Interface-to-Code Mapping

- [ ] Map the prototype icon rail and workspace tree to the existing workspace scanning and file-tree service.
- [ ] Map the central content area to the original `Swarm`, `Chat`, `Code`, and `Review` flow model.
- [ ] Map the right-side panel to the existing swarm network, transcript, and synthesis/review visibility pattern.
- [ ] Reuse the original Agent Swarm interface components from `src/view.ts`, `src/network.ts`, and the pending review renderer pattern as the standalone baseline UI.
- [ ] Continue recycling the original business logic and UI structure while changing only the Obsidian-specific integration and app shell boundaries needed to make the app independent.
- [ ] Keep the original swarm semantics stable while changing only the standalone renderer surface.

## Storage and Settings

- [x] Replace Obsidian save/load settings behavior with a local JSON settings store.
- [x] Create a folder-backed chat note store for markdown history.
- [x] Create a workspace directory model for project file browsing.
- [ ] Add changelog generation for approved file changes.

## Packaging

- [x] Add Electron package and build scripts.
- [x] Add a production build path and renderer bundling.
- [x] Test the desktop app locally.
- [x] Prepare a release package for the standalone app.
