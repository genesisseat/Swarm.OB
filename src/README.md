# Source Function Reference

This folder contains the TypeScript implementation for the Agent Swarm Obsidian plugin. The source is bundled from `main.ts`; `main.js` at the project root is generated output.

## `main.ts`

### `AgentSwarmPlugin`

- `onload()` loads persisted settings, registers the Agent Swarm and Code Editor views, adds ribbon icons, registers command-palette commands, and installs `AgentSwarmSettingTab`.
- `onunload()` flushes the pending debounced settings write before the plugin is unloaded.
- `activateView()` finds the existing Agent Swarm leaf or creates one in the right sidebar, then reveals it.
- `activateCodeEditorWindow()` finds the existing standalone editor or creates a popout leaf for it.
- `loadSettings()` shallow-merges saved Obsidian data over `DEFAULT_SETTINGS`.
- `saveSettings()` coalesces rapid calls into one `saveData()` operation after 250 ms and resolves all waiting callers.

## `types.ts`

### Types and constants

- `Provider` restricts provider IDs to `anthropic`, `openai`, `google`, `deepseek`, and `ollama`.
- `AgentConfig` describes an agent persona, color, provider, optional model, and optional key/endpoint override.
- `SwarmSettings` contains provider credentials, roster, debate, synthesis, chat, editor, file-access, Autopilot, and Coder Mode settings.
- `TranscriptMessage` is one completed swarm turn.
- `ChatMessage` is one user or assistant turn with an epoch timestamp.
- `PROVIDER_LABELS` maps provider IDs to display names.
- `DEFAULT_SETTINGS` supplies default providers, models, prompts, four general agents, and folder settings.

### Functions

- `defaultModelFor(settings, provider)` selects the configured default model for the requested provider. Agent and synthesis overrides are resolved by callers before requests are made.

## `providers.ts`

- `ProviderErrorKind` identifies retryable, recoverable, and permanent failure categories.
- `ProviderApiError` carries a user-facing message, HTTP status, and classified error kind.
- `classify(status, message)` maps HTTP status and error text to rate-limit, server, token-limit, auth, or other categories.
- `sleep(ms)` delays retry attempts.
- `parseKeyPool(raw)` splits Google credentials on commas and newlines, trims them, and removes empty entries.
- `nextKey(provider, keys)` advances an in-memory provider rotation cursor.
- `callModel(...)` is the public request gateway. It dispatches a request, retries 429/5xx failures up to three attempts with exponential backoff and jitter, and reports retries through a callback.
- `dispatch(...)` selects the provider-specific implementation and applies per-agent overrides before shared settings.
- `callAnthropic(...)` sends the Anthropic Messages API request and extracts text blocks from the response.
- `callOpenAICompatible(...)` handles both OpenAI and DeepSeek response formats through a shared chat-completions implementation.
- `callGoogle(...)` sends Gemini requests, rotates through the configured key pool on 429/5xx responses, and extracts candidate parts.
- `callOllama(...)` calls the local Ollama endpoint and extracts `message.content`.
- `extractErrorMessage(json)` converts common provider error payloads into a readable string.

## `swarm.ts`

- `formatTranscript(topic, messages, truncatedNotice?)` turns the topic and debate messages into the prompt context supplied to an agent or synthesizer.
- `shrinkTranscript(messages)` keeps the newest half of the transcript, with at least two messages.
- `callAgentWithTokenLimitHandling(...)` calls a model normally, then retries once with a shortened transcript when the provider reports a token-limit failure.
- `runDebate(...)` executes rounds sequentially and agents in roster order. It handles cancellation, provider/model selection, UI callbacks, file-request resolution, and incremental transcript delivery.
- `resolveFileRequests(...)` converts list/read blocks into transcript attachments and write blocks into `PendingChange` records. It never writes proposed content itself.
- `runSynthesis(...)` sends the full transcript to the configured synthesis model and wraps errors with the provider label.

## `chat.ts`

- `formatHistory(messages, truncatedNotice?)` formats the one-to-one conversation for a model prompt.
- `shrinkHistory(messages)` retains the newest half of a long chat while keeping at least two messages.
- `runChatReply(...)` sends the configured chat history, retries once with shortened history after a token-limit error, and exposes transient retry callbacks.

## `agentFileOps.ts`

### Data structures

- `FileWriteRequest` stores a relative target path and complete replacement content.
- `PendingChange` stores the proposed file, previous content, agent, round, timestamp, and resolved vault path.

### Functions

- `fileAccessInstructions(projectRoot)` creates the exact prompt instructions and fenced-block syntax agents must use for listing, reading, and proposing writes.
- `extractReadRequests(text)` extracts non-empty `agent-file-read` paths.
- `extractWriteRequests(text)` extracts `agent-file-write` blocks and preserves their complete contents.
- `extractListRequests(text)` extracts `agent-file-list` paths, including an empty path for the project root.
- `resolveProjectPath(root, relPath)` joins a relative path to the project root and rejects absolute paths, drive-letter paths, and traversal segments.
- `resolveProjectFolderPath(root, relPath)` applies the same safety rules while allowing an empty path to mean the root folder.
- `readFileForAgent(app, root, relPath)` safely reads one vault text file.
- `listFolderForAgent(app, root, relPath)` lists immediate children with folders first and alphabetical ordering.
- `readExistingForDiff(app, fullPath)` reads the current content used for a pending-change comparison.
- `ensureFolderChain(app, path)` creates missing parent folders and tolerates creation races.
- `applyChange(app, change)` creates parent folders, then creates or replaces the target file after approval.
- `logChange(app, root, changelogFileName, change)` appends an audit row or creates a Markdown changelog with a header.

## `chatStore.ts`

- `titleFromFirstMessage(text)` derives a short filesystem-safe title from the first non-empty line.
- `formatTime(epochMs)` formats message timestamps through Obsidian's Moment instance.
- `serializeChatNote(meta, messages)` renders readable frontmatter/Markdown and embeds a hidden JSON message block.
- `parseChatNote(content)` validates and parses the hidden JSON block, returning only valid user/assistant messages.
- `titleFromFrontmatter(content)` extracts a saved title when available.
- `ensureChatFolder(app, folderPath)` normalizes a folder path and creates missing folder levels.
- `listChatNotes(app, folderPath)` scans Markdown files, filters to Agent Swarm chat notes, creates previews, and sorts newest first.
- `buildChatFileName(title)` combines a title with a timestamp for a new chat note.
- `updateConversationsIndex(app, folderPath)` regenerates `Conversations.md` with wikilinks, dates, and previews.
- `providerLabel(provider)` exposes the display label for a provider.

## `view.ts`

### View lifecycle and mode switching

- `AgentSwarmView.onOpen()` builds the header, mode tabs, controls, Swarm panel, Chat panel, and Code panel.
- `onClose()` stops the network animation and destroys the embedded editor.
- `setMode(mode)` switches visible panels, active tab styling, mode-specific header controls, and Code editor focus.
- `prefillChatFromExternal(text)` accepts code from the standalone editor, inserts it into Chat, reveals the panel, and focuses the composer.
- `buildSwarmMode(container)` creates file-access controls, pending changes, network diagram, transcript area, topic composer, and active-note import behavior.
- `buildChatMode(container)` creates the chat transcript area and chat composer.
- `buildCodeMode(container)` creates the single-file CodeMirror toolbar and editor.

### File access and approval

- `updateFileAccessBar()` synchronizes project-root text and enables/disables Coder Mode and Autopilot controls.
- `handleAutopilotToggle()` requires confirmation before bypassing the pending-change review.
- `setCoderMode(enable)` snapshots/restores the custom roster and swaps in `DEV_TEAM_AGENTS`.
- `addPendingChange(change)` either applies/logs a change in Autopilot or adds it to the review list.
- `renderPendingChanges()` renders the action, path, truncated preview, Approve button, and Reject button for each proposal.
- `applyAndLog(change)` applies the vault change and records it in the changelog.
- `approvePendingChange(id)` applies one queued proposal and removes it from the panel.
- `rejectPendingChange(id)` removes one queued proposal without touching the vault.

### Code integration

- `codeExtensionFor(key)` maps a language key to its default extension.
- `syncFileNameExtension(key)` updates the current filename extension after a language change.
- `newCodeFile()` resets the inline editor to a new JavaScript document.
- `copyCode()` copies inline editor content to the clipboard.
- `saveCodeFile()` creates or modifies a vault file in the configured code folder.
- `sendCodeToChat()` places the inline editor content in Chat as a fenced block.
- `insertCodeIntoEditor(code, langKey)` loads a rendered code block into Code mode as an unsaved document.
- `wireCodeBlockInserts(container)` adds Insert to editor buttons under rendered fenced code blocks.

### Swarm and rendering

- `autoGrowComposer()` keeps the swarm topic textarea within its minimum and maximum height.
- `setSendBtnState(state)` changes the start/stop button icon, disabled state, and label.
- `setRunning(running)` disables inputs during a debate and updates button state.
- `scrollToBottom()` keeps the swarm transcript at the newest content.
- `showRetryNotice(...)` and `clearRetryNotice()` display transient provider retry status.
- `handleStart()` validates input, builds the graph, runs the debate, renders messages, runs synthesis, and handles cancellation/errors.
- `renderStatus(text)` adds a status message to the transcript.
- `renderMessage(msg)` renders one agent response with agent color, provider, round, Markdown, and code-block actions.
- `renderSynthesis(text)` renders the final synthesis and exposes the Create note action.
- `createSynthesisNote()` writes a vault note containing the synthesis and complete debate transcript.

### Chat behavior

- `autoGrowChatComposer()` sizes the chat textarea.
- `setChatRunning(running)` locks chat controls during a provider request.
- `chatScrollToBottom()` keeps the chat transcript at the newest message.
- `showChatRetryNotice(...)` and `clearChatRetryNotice()` display assistant retry status.
- `renderChatMessage(msg)` renders a user or assistant Markdown message.
- `renderAllChatMessages()` rebuilds the chat transcript from the current in-memory history.
- `handleChatSend()` appends and persists the user message, requests an assistant reply, appends/persists the reply, and restores controls.
- `persistChat()` creates or modifies the chat note and refreshes the conversations index.
- `startNewChat()` clears in-memory conversation state and resets the UI.
- `openChatHistory()` lists saved notes and opens `ChatHistoryModal`.
- `loadChatNote(note)` parses a selected note and restores its messages and file reference.

## `network.ts`

- `NodeState` is `idle`, `active`, `done`, or `error`.
- `SwarmNetworkGraph.build(agents, rounds)` lays out Topic, round columns, agent nodes, edges, legend, and Synthesis as SVG.
- `setAgentActive(agentId, round)` activates an agent node and incoming edge bundle.
- `setAgentDone(agentId, round)` completes an agent node and completes a round bundle after every agent finishes.
- `setAgentError(agentId, round)` marks the agent and incoming bundle as failed.
- `setSynthesisActive()`, `setSynthesisDone()`, and `setSynthesisError()` update the final synthesis node and edge.
- `clear()` stops animation and removes graph contents.
- `startTicking()` and `stopTicking()` manage the active-edge animation timer.
- `tick()` regenerates active edge paths and slightly varies opacity and width.
- `straightenBundle(el)` returns an edge bundle to straight paths after activity ends.
- `renderLegend(agents)`, `renderBundle(id, from, to)`, and `renderNode(node, cls, badgeText)` generate SVG fragments.
- `setNodeState(id, state)` and `setBundleState(id, state)` update graph DOM state.
- `boltPath(x1, y1, x2, y2)` builds a jittered path with anchored endpoints.
- `cssEscape(id)`, `cssEscapeAttr(id)`, and `escapeXml(value)` protect generated SVG/selector strings.

## `codeEditor.ts`

- `languageKeyFromFenceInfo(info)` maps Markdown fence labels such as `js`, `ts`, and `py` to supported language keys.
- `isBinaryExtension(ext)` identifies extensions that must not be loaded into a text editor.
- `isTextEditable(ext)` accepts known text extensions and short unknown/config extensions while rejecting known binaries.
- `languageKeyFromExtension(ext)` maps a file extension to syntax highlighting, including aliases such as `tsx`, `scss`, and `yaml`.
- `languageExtension(key)` returns the matching CodeMirror language extension or no extension for plaintext.
- `CodeEditor.constructor(...)` creates CodeMirror with editing features, Obsidian theme variables, language compartment, change callback, and resize repair.
- `getValue()` returns the current document text.
- `setValue(doc)` replaces the entire document.
- `setLanguage(key)` reconfigures syntax highlighting without rebuilding the editor.
- `focus()` focuses the CodeMirror view.
- `destroy()` disconnects the resize observer and destroys the CodeMirror view.

## `codeEditorView.ts`

- `CodeEditorView.onOpen()` builds the project sidebar, toolbar, language selector, file actions, and CodeMirror editor.
- `onClose()` destroys the CodeMirror instance.
- `rootDisplayName()` returns the configured project root or `Vault root`.
- `openProjectFolderPicker()` changes the project root and refreshes the file tree.
- `newFolderAtRoot()` creates a folder below the selected project root.
- `newFile()` creates and opens an empty vault file.
- `openFile(file)` blocks binary files, autosaves dirty content, loads text, selects language highlighting, and updates the path label.
- `saveCurrentFile()` writes the current editor document to the open file.
- `copyContents()` copies the standalone editor document to the clipboard.
- `sendToChat()` sends standalone editor text to the main Chat tab through the shared Obsidian plugin instance.

## `fileTree.ts`

- `FileTree.setRoot(rootPath)` changes the scope and resets expansion state.
- `render()` resolves the root folder and rebuilds the complete tree.
- `renderFolderChildren(folder, parentEl, depth)` sorts and recursively renders child folders/files.
- `renderFolderRow(folder, parentEl, depth)` creates expand/collapse, folder icon, new-folder, and context-menu behavior.
- `renderFileRow(file, parentEl, depth)` creates a clickable file row that delegates opening to the editor view.
- `promptNewFolder(parent)` opens `NamePromptModal`, creates the folder, refreshes the tree, and reports errors.

## Modal Components

### `folderPickerModal.ts`

- `FolderPickerModal.onOpen()` offers vault root, existing folders, and a typed path that can be created and selected.
- `onClose()` clears modal content.

### `namePromptModal.ts`

- `NamePromptModal.onOpen()` creates a text input and Create button and supports Enter submission.
- `submit()` trims and validates the name, closes the modal, and invokes the callback.
- `onClose()` clears modal content.

### `confirmModal.ts`

- `ConfirmModal.onOpen()` renders a message, Cancel button, and warning confirmation button.
- `onClose()` clears modal content.

### `chatHistoryModal.ts`

- `getSuggestions(query)` filters saved conversations by title or preview.
- `renderSuggestion(note, el)` renders title, relative update time, and preview.
- `onChooseSuggestion(note)` forwards the selected note to the caller.

## `settings.ts`

- `AgentSwarmSettingTab.display()` rebuilds the complete Obsidian settings page. It creates controls for provider credentials/models, rounds, note inclusion, default provider, chat, code folders, project roots, file access, Autopilot, synthesis, and the editable agent roster. Every control updates `plugin.settings` and calls the debounced `saveSettings()`.

## `devTeamPreset.ts`

- `DEV_TEAM_AGENTS` is the built-in coding roster: Architect for structure, Backend for server/API/data files, Frontend for client files, and Reviewer for read-only critique. The roles are intentionally separated to reduce file-write collisions.
