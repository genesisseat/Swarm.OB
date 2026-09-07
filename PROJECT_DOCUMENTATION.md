# Agent Swarm Project Documentation

## 1. Purpose

Agent Swarm is an Obsidian plugin that combines five workflows in one panel:

1. Multi-agent debates with configurable personas, providers, models, and rounds.
2. A separate one-to-one AI chat with automatically saved Markdown history.
3. A lightweight CodeMirror editor for a single file.
4. A standalone project-style editor with a recursive vault file tree.
5. Optional, controlled project-folder access for agents that can read files and propose changes.

The plugin does not execute code. The editors only read and write text files in the Obsidian vault.

## 2. Important Files

| File | Function |
| --- | --- |
| `manifest.json` | Obsidian plugin metadata, version, minimum Obsidian version, and feature description. |
| `package.json` | Dependencies and `dev` / `build` scripts. |
| `tsconfig.json` | TypeScript compiler configuration for `src/**/*.ts`. |
| `esbuild.config.mjs` | Development watch build and production bundle configuration. |
| `main.js` | Generated CommonJS bundle. Do not edit it directly; rebuild it from `src/main.ts`. |
| `styles.css` | Obsidian-themed layout and visual styles for all views, controls, diagrams, editors, and modals. |
| `versions.json` | Version compatibility metadata used by the plugin release process. |
| `src/` | TypeScript source code. See `src/README.md` for function-level documentation. |

## 3. Build and Development

Install dependencies:

```bash
npm install
```

Run the development watcher:

```bash
npm run dev
```

The watcher bundles `src/main.ts` into `main.js` and uses inline source maps.

Create a production build:

```bash
npm run build
```

The production command first runs TypeScript checking with `tsc -noEmit -skipLibCheck`, then creates a minified bundle without source maps.

The bundle is CommonJS, targets ES2018, tree-shakes unused code, and externalizes Obsidian, Electron, Node built-ins, CodeMirror, and Lezer packages.

## 4. Runtime Entry Point

`src/main.ts` exports the default `AgentSwarmPlugin` class. Obsidian calls:

- `onload()` to load settings, register both views, register ribbon icons and commands, and add the settings tab.
- `onunload()` to flush a pending debounced settings save.

The plugin registers two view types:

- `agent-swarm-view`: the sidebar panel containing Swarm, Chat, and Code tabs.
- `agent-swarm-code-editor-view`: the standalone project editor, normally opened in an Obsidian popout window.

`activateView()` opens or reveals the main panel. `activateCodeEditorWindow()` opens or reveals the standalone editor. Settings are loaded through Obsidian's `loadData()` and saved through `saveData()` with a 250 ms debounce so text-field edits do not create competing writes.

## 5. End-to-End Swarm Flow

```text
User enters topic or imports active note
        |
        v
AgentSwarmView.handleStart()
        |
        v
runDebate()
        |
        +--> for each round
        |       +--> for each configured agent
        |               +--> callAgentWithTokenLimitHandling()
        |                       +--> callModel()
        |                               +--> provider-specific HTTP request
        |               +--> resolve file list/read/write blocks when enabled
        |               +--> render message and update network graph
        |
        v
runSynthesis()
        |
        +--> render synthesis
        +--> optionally create a vault note with synthesis and transcript
```

Agents run sequentially in roster order. Each later agent receives the accumulated transcript. The transcript contains the round, agent name, and response text.

A rate-limit or server error is retried by `callModel()`. A token-limit error causes `swarm.ts` to retain the most recent half of the transcript and retry once. The UI receives callbacks for agent start, completion, error, retry, and pending file changes.

## 6. Provider Behavior

Supported providers are Anthropic, OpenAI, Google AI Studio, DeepSeek, and Ollama.

`src/providers.ts` dispatches each request to the correct API shape:

- Anthropic uses `/v1/messages` and the `x-api-key` header.
- OpenAI and DeepSeek use OpenAI-compatible `/chat/completions` requests.
- Google uses `generateContent` and can rotate through newline- or comma-separated keys.
- Ollama uses a configurable local `/api/chat` endpoint with `stream: false`.

All requests use Obsidian `requestUrl()` to avoid browser CORS restrictions. Provider errors are classified as `rate_limit`, `server`, `token_limit`, `auth`, or `other` so callers can choose the correct recovery behavior.

## 7. Chat Flow and Storage

The Chat tab uses `runChatReply()` rather than the multi-agent loop. It sends the complete conversation as a formatted history. On a token-limit failure it retries once with the newest messages only.

The view persists the user message before calling the provider, so a failed assistant response does not lose the user's question. After a successful response it persists again.

Chat notes contain:

- YAML-like frontmatter for title, timestamps, provider, and model.
- Human-readable Markdown headings and messages.
- A hidden JSON block between `%%agent-swarm-chat-data` and `%%` markers.

The hidden block is the source of truth when reopening a conversation. `Conversations.md` is regenerated after each save and contains wikilinks and previews for Obsidian navigation and graph view.

## 8. File Access and Change Safety

File access is disabled by default. When enabled and a project root is selected, the plugin adds instructions to agent prompts. Agents can request:

- `agent-file-list` to list immediate folder children.
- `agent-file-read` to read a vault file.
- `agent-file-write` to propose complete replacement content.

`resolveProjectPath()` rejects absolute paths, drive-letter paths, and any `..` segment. Reads are resolved immediately and appended to the transcript. Writes become `PendingChange` objects and are not written by `runDebate()`.

The Swarm view normally shows a preview with Approve and Reject actions. Approved changes are applied with `applyChange()` and recorded with `logChange()` in the configured changelog. Autopilot is an explicit opt-in that applies each proposal immediately after confirmation.

Coder Mode replaces the user's roster with Architect, Backend, Frontend, and Reviewer. The original roster is deep-copied and restored when Coder Mode is disabled. The preset reduces write collisions by assigning different responsibilities, but the system does not merge conflicting edits.

## 9. Code Editors

`src/codeEditor.ts` wraps CodeMirror 6. It provides line numbers, history, search, bracket matching, autocomplete, indentation, line wrapping, Obsidian theme integration, and language switching through a `Compartment` so changing languages preserves the document and undo history.

The supported language keys are JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, C/C++, Java, Rust, SQL, PHP, XML, and plaintext.

The Code tab in `AgentSwarmView` is a quick editor. The standalone `CodeEditorView` adds:

- A recursive `FileTree` sidebar.
- Project-root selection.
- New folder and new file actions.
- Text/binary extension checks.
- Best-effort autosave when switching files.
- Ctrl/Cmd+S saving.
- Clipboard copy and Send to Chat.

Code can move in both directions: the editor sends a fenced code block to Chat, and rendered fenced blocks show an Insert to editor action.

## 10. Settings Model

`src/types.ts` defines `SwarmSettings`, including:

- Shared provider keys, models, and Ollama URL.
- Agent roster and number of rounds.
- Synthesis provider, model, and prompt.
- Current-note inclusion behavior.
- Chat provider, model, prompt, and folder.
- Code folder and project root.
- Swarm project root, changelog, file-access switch, and Autopilot.
- Coder Mode state and the saved previous roster.

`DEFAULT_SETTINGS` supplies four general debate agents: Advocate, Skeptic, Wildcard, and Analyst.

## 11. Known Design Constraints

- Settings are shallow-merged when loaded; there is no explicit migration for partially missing nested settings.
- Empty file-access project root means the entire vault is in scope, so it should be used carefully.
- File writes replace complete file contents and have no conflict or merge detection.
- Pending change previews are limited to 600 characters even though the full proposal is stored.
- Google key rotation is in-memory and resets when the plugin process restarts.
- Chat filenames include seconds, so extremely rapid duplicate creation can theoretically collide.
- Standalone editor autosave on file switching is best-effort and has no close-time dirty confirmation.

## 12. Source Documentation

See [`src/README.md`](src/README.md) for the module-by-module function catalog and call responsibilities.
