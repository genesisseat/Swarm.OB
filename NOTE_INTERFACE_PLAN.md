# Note Interface and Functionality Plan

## Goal

Turn the current agent-swarm workspace into a standalone desktop app that preserves the Obsidian-style experience of notes, markdown conversations, a project workspace, and reviewable file changes.

## Core Design

The new app should have a note-first workflow with these major zones:

1. Workspace left tree
2. Main note and prompt area
3. Chat and swarm discussion panel
4. Review queue for file changes
5. Editor or code workspace panel

## Main UI Sections

### 1. Workspace Tree

- Shows project folders and files
- Supports folder expansion/collapse
- Keeps file launch behavior consistent with a local file system
- Allows user to open markdown notes and source files

### 2. Note Panel

- Renders a note editor for the active markdown file
- Supports frontmatter-like metadata or a metadata drawer
- Supports markdown preview and plain markdown editing mode
- Stores note changes locally in the workspace

### 3. Swarm Panel

- Accepts a topic or note context
- Shows multi-agent responses in transcript form
- Produces a synthesized note or markdown output
- Saves the synthesis into a new note or conversation note

### 4. Chat Panel

- Keeps one-to-one assistant conversation history
- Uses a markdown conversation structure similar to the Obsidian plugin notes
- Saves each conversation in a note file

### 5. Review / Approval Queue

- Accepts file write requests from agents
- Displays proposed file, prior content, and change summary
- Allows Approve, Reject, and Apply actions
- Writes to the workspace only after approval

## Prototype UI Status

The renderer now has a concrete prototype layout inspired by the Obsidian screenshot:

1. A left icon rail for workspace navigation.
2. A workspace or folder area for project content.
3. A central tab/content stage for the note-first editor and other app panels.
4. A right-side agent panel for the swarm and synthesis model.

This is the current milestone and should be treated as the baseline for the next implementation pass.

## App Data Model

```text
Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  updatedAt: number;
  createdAt: number;
}

ConversationNote extends Note {
  type: "chat";
  provider: string;
  model: string;
}

SynthesisNote extends Note {
  type: "synthesis";
  topic: string;
  transcript: string;
}
```

## Proposed Service Layer

```text
NoteService
  createNote()
  openNote()
  saveNote()
  previewNote()

ChatHistoryService
  saveConversation()
  loadConversation()
  listConversationFiles()

WorkspaceService
  scanFolder()
  openFile()
  saveFile()
  listFolders()

ReviewService
  queueFileChange()
  approveFileChange()
  rejectFileChange()
  logChange()
```

## File Storage Strategy

- Store notes as markdown files in a local notes folder.
- Keep a "Conversations" or "Chat Notes" folder.
- Keep a changelog file for approved file changes.
- Support workspace-relative file safety rules.

## App Workflow

1. User opens workspace folder.
2. User selects or creates a markdown note.
3. User can switch between note editor, swarm, chat, and review.
4. Agents propose edits and file reads/writes.
5. Review queue shows changes before writing.
6. Approved changes are logged into a changelog.

## UI Implementation

Use the current Electron + React renderer shell as the base:

- Workspace tree component
- Note editor component
- Chat transcript component
- Agent swarm panel
- Review queue component

This lets the standalone app keep the left navigation and note-like workspace behavior while moving away from Obsidian plugin structure.
