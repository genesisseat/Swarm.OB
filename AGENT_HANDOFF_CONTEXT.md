# Agent Handoff Context

## Repository

This repository is the standalone migration path for the original Obsidian plugin architecture.

## Current Working Guidance

The source-of-truth business logic should stay anchored in the original logic files rather than being rewritten from scratch:

- `src/swarm.ts` for swarm orchestration and debate execution.
- `src/providers.ts` for provider dispatch, error categorization, and retry semantics.
- `src/agentFileOps.ts` for file-access parsing and safe review/change proposals.
- `src/view.ts` for the original Agent Swarm interface components and UI flow.
- `src/network.ts` for the network graph semantics shown in the original interface.

The migration goal is to keep reusing and recycling the original code wherever the feature is still valid, and only change the adapter, shell, platform, and file-storage boundaries that must be rewritten to make the app independent of Obsidian itself.

## Reuse Requirement

The standalone renderer must keep the original Agent Swarm interface flow visible and reusable:

- `AgentSwarmView` mode tabs (`Swarm`, `Chat`, `Code`).
- file access bar and toggles.
- pending changes review panel and approval/rejection actions.
- network diagram display.
- chat composer and code editor flow.
- transcript, empty-state, and composer UI familiar from the plugin implementation.

These UI structures should be taken as the baseline object model for the standalone renderer, not as a new replacement layout.

## Current Implementation Status

The workspace is already in a scaffolded standalone architecture shape:

- `src/renderer/App.tsx` is the new standalone renderer shell.
- `src/services/*` service files are the intended standalone service layer.
- `src/storage/*` stores provide local settings, workspace metadata, and chat persistence scaffolding.
- `scripts/smoke-test.mjs` only verifies scaffold file presence right now.

## What Can Be Tested Right Now

The most reliable testable logic that is already present in the repo includes:

1. `extractReadRequests()`
2. `extractWriteRequests()`
3. `extractListRequests()`
4. `resolveProjectPath()`
5. `readFileForAgent()`
6. `listFolderForAgent()`
7. provider error classification and provider dispatch paths in `src/providers.ts`
8. settings import and persistence shape in `src/storage/settingsStore.ts`
9. workspace tree creation in `src/storage/workspaceStore.ts`
10. chat note serialization in `src/chatStore.ts`

These tests should be introduced before more UI work is layered on.

## Build / Smoke Command

The workspace can be verified with:

```powershell
$env:Path += ';C:\Program Files\nodejs'; npm run build ; npm run test:smoke
```

## Important Constraint

Do not replace the core debate, synthesis, file-access safety, and provider-dispatch semantics just to make the UI look like the standalone prototype. Preserve the original contract as the new standalone app’s source of truth.
