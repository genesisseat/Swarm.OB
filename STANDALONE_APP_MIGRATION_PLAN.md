# Standalone App Migration Plan

This workspace is a working clone of the original repository at https://github.com/genesisseat/Swarm.OB. The source product began as an Obsidian extension/plugin, and the current goal is to convert that same note, swarm, provider, workspace, and review model into an independent standalone desktop application.

This repository already has the right product capabilities for a standalone desktop experience. The main architectural dependency to remove is Obsidian-specific runtime wiring. The migration should extract the agent engine, provider adapters, UI model, and file-safety service into a general app runtime.

## Target Product

Build a local desktop application that offers:

- Multi-agent debate and synthesis
- One-to-one chat with saved markdown/history files
- A standalone project workspace editor with recursive file tree
- A safe file review and approval queue for proposed file writes
- Provider configuration for Anthropic, OpenAI, Google, DeepSeek, and Ollama

## Migration Strategy

### Phase 1: Separate Core Services from Plugin Shell

Move the current business logic out from Obsidian-specific plugin lifecycle hooks.

- Keep provider abstraction from `src/providers.ts`
- Keep agent debate orchestration from `src/swarm.ts`
- Keep chat serialization logic from `src/chatStore.ts`
- Keep file request parsing/safe file operations from `src/agentFileOps.ts`

These modules must become app services that receive a runtime context object rather than a plugin object.

### Phase 2: Introduce an App Runtime

Create a top-level runtime container with:

- `AppShell` for window/layout
- `ViewRegistry` for tabs and sidebars
- `SettingsStore` for provider and workspace configuration
- `ProjectService` for workspace directory scanning and file handling
- `ChatStore` for chat note save/load
- `AgentOrchestrator` for debate and synthesis

### Phase 3: Replace Obsidian UI Hooks

Replace plugin registration in `src/main.ts` using Obsidian leaf views and workspace creation with normal app screens.

Map the existing UI model:

- `Swarm` tab -> Debate workspace
- `Chat` tab -> Conversation workspace
- `Code` mode -> File editor workspace
- `Pending changes` -> Review queue

### Phase 4: Standardize Local Persistence

Create a local persistence layer that replaces Obsidian `saveData()` and `loadData()` behavior:

- JSON settings file
- Chat note markdown folder
- Changelog markdown file
- Review queue state

### Prototype Interface Milestone

The prototype renderer now follows a screenshot-inspired layout:

- icon rail and workspace navigation
- file and folder list
- central note/editor and tab stage
- right-hand agent/swarm preview panel

The next migration step is to connect the prototype view to actual local store services instead of static UI scaffolds.

## Data Settings and Config Import Plan

The current repository settings model should be initialized from the sample workspace configuration in `data.json`, which already carries the expected six-agent swarm roster and a single synthesis configuration. The standalone settings store should therefore read the existing field names directly instead of relying on a blank in-memory default object.

The verification command for the local data-backed schema should remain:

```text
$env:Path += ';C:\Program Files\nodejs'; npm run build ; npm run test:smoke
```

That command should continue to prove that the settings service, TypeScript configuration, and smoke-test path remain valid after the data.json integration.

## Interface Model Testing Requirement

The standalone prototype needs an interface layer that can exercise the two original model-facing workflows directly:

1. `Swarm` mode: the multi-agent debate and synthesis flow driven by the same provider and settings model from `data.json`.
2. `Chat` mode: the normal one-to-one provider-backed chat flow that uses the same provider configuration and chat model fields.

The prototype UI should include a visible mode switch that can route the user between those two flows and should support a smoke test that verifies the view can render both the debate and normal chat panels using the shared sample configuration.

The testing requirement for the interface should therefore be:

```text
npm run build
npm run test:smoke
```

and the smoke test should confirm that the configured provider, six-agent roster, and synthesis/chat model fields load into the standalone interface without crashing.

## Initial Module Implementation Order

The first module work should be the basic app scaffold and the cross-cutting local services that every UI view depends on.

### Priority Module 1 — Settings and Workspace Store

- Create a file-backed app settings model.
- Support workspace root selection.
- Persist service registry configuration to a JSON config file.

### Priority Module 2 — File and Workspace Service

- Add a recursive workspace folder scanner.
- Expose workspace metadata for the folder tree.
- Support folder/file open logic for the note and code views.

### Priority Module 3 — Chat and Note Store

- Save markdown conversations locally.
- Save note content to a folder-backed markdown store.
- Support note title, folder, content, and timestamp metadata.

### Priority Module 4 — Review Queue Service

- Capture proposed file change events.
- Store pending review items and review state locally.
- Add approve, reject, and apply actions.

### Priority Module 5 — Provider and Agent Registry

- Define available provider adapters.
- Register provider model, label, and request formatting.
- Connect the swarm service to the registry for a first live agent loop.

## Reusable Swarm Agent Mechanics Review

The original swarm logic in the repository should remain a strong reusable source for the standalone version. Its main mechanics are:

1. `runDebate()` in `src/swarm.ts` creates a transcript array and loops through rounds and all configured agents.
2. Each agent receives the same evolving transcript context, and the function adds an instruction that encourages the agent to add to, challenge, or build on the prior discussion.
3. `callAgentWithTokenLimitHandling()` retries after shrinking the transcript when a provider returns a token-limit error, rather than repeating the same oversized request.
4. `resolveFileRequests()` reads `agent-file-list`, `agent-file-read`, and `agent-file-write` blocks from agent responses, appends file listings/read results to the transcript, and turns file-write requests into `PendingChange` objects suitable for a review queue.
5. `callModel()` and `dispatch()` in `src/providers.ts` contain the provider abstraction and route each agent to the correct provider-specific request payload and API call.

These mechanics are portable to the independent app because they already separate four things clearly:

- agent round ordering and transcript assembly
- provider adapter dispatch and model retry structure
- file access instructions and file-request extraction
- pending change review object creation without direct file writes

The reusable pieces should be lifted into the standalone service layer as `SwarmService`, `ProviderService`, `ReviewService`, and `Workspace/FileAccessService` rather than replaced wholesale.

## Interface-to-Code Mapping and Architecture Guardrail

The new prototype should be treated as a layout shell that uses the existing original architecture as its data and orchestration source of truth.

- Keep `runDebate()` as the round-execution model and preserve the transcript-based debate contract.
- Keep `runSynthesis()` as the post-debate synthesis pass and preserve its own provider/model selection path.
- Keep the file-access syntax (`agent-file-list`, `agent-file-read`, `agent-file-write`) as the contract for safe reviewable changes.
- Keep `PendingChange` and the `resolveFileRequests()` behavior as the queue model that turns agent-generated write suggestions into reviewable items.
- Keep `callModel()` and the provider dispatch chain in `src/providers.ts` as the provider adapter source of truth for retry/error classification and consistent provider abstraction.

The original interface components and UI model should also be reused directly where possible:

- `AgentSwarmView` in `src/view.ts` provides the host `Agent Swarm` frame, mode tabs (`Swarm`, `Chat`, `Code`), the file access bar, pending changes panel, network panel, composer, status panels, and chat/code editor composition layout.
- `SwarmNetworkGraph` in `src/network.ts` provides the live graph model and visual network node semantics for the swarm debate display.
- `renderMessage()`, `renderSynthesis()`, `renderPendingChanges()`, and `buildChatMode()` in `src/view.ts` define the original message rendering and reply display conventions.
- `PendingChange` and its review panel logic in `src/view.ts` and `src/agentFileOps.ts` define the review queue UI contract and approval flow.

The prototype layout can be adjusted to match the original interface flow:

- the left icon rail is a navigation shell
- the workspace/folder list should be rendered over the workspace service and file tree model
- the central panel should host the note, chat, code, or review runner using the same app-mode mapping as the original view model
- the right-hand panel should show the same agent/network and synthesis/review state pattern used by the original UI

No change should be made to the underlying debate architecture, round scheduling, synthesis pass, file-safety request contract, provider dispatch model, or pending review semantics. Only the standalone renderer shell and styling receive the screenshot-inspired layout adaptation. The reusable UI components from the original code should be ported into the standalone renderer as the baseline object model rather than replaced by a brand-new layout.

The implementation principle is to keep recycling the original codebase and only adapt the dependency and platform portions that must be changed for independence from Obsidian. In practice that means reusing the original source logic and UI components as the reusable core while replacing or wrapping Obsidian-only APIs such as `ItemView`, `WorkspaceLeaf`, `Vault`, `TFile`, and plugin settings persistence with standalone equivalents.

### Phase 5: Package as Desktop App

Package the app with Electron or Tauri and expose a stable local app shell.

Recommended structure:

```text
app/
  shell/
  services/
  ui/
  storage/
  providers/
```

## Implementation Sequence

1. Start from the existing core service boundaries.
2. Build a runtime adapter interface that accepts app-level dependencies.
3. Add local filesystem and settings adapters.
4. Replace the Obsidian `Plugin` bootstrap layer with a general app startup layer.
5. Add a desktop packaging wrapper.

## Success Criteria

The standalone app should have:

- no dependency on Obsidian view registration,
- reusable provider adapters,
- a project folder permission model,
- human-approved file write queue,
- a normal local settings and chat storage model.
