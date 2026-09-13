import fs from "fs";
import path from "path";

const required = [
  "src/app/main.ts",
  "src/app/preload.ts",
  "src/renderer/App.tsx",
  "src/renderer/views/SwarmView.tsx",
  "src/renderer/views/ChatView.tsx",
  "src/renderer/views/EditorView.tsx",
  "src/renderer/views/ReviewView.tsx",
  "src/services/providerService.ts",
  "src/services/chatService.ts",
  "src/services/swarmService.ts",
  "src/services/workspaceService.ts",
  "src/services/settingsService.ts",
  "src/services/reviewService.ts",
  "src/services/appContext.ts",
  "src/storage/settingsStore.ts",
  "src/storage/chatHistoryStore.ts",
  "src/storage/workspaceStore.ts",
  "src/renderer/components/Layout.tsx",
  "src/renderer/components/WorkspaceTree.tsx",
  "src/renderer/components/ReviewQueue.tsx",
  "src/renderer/components/ChatComposer.tsx",
  "electron-builder.config.json",
];

const missing = required.filter((file) => !fs.existsSync(path.join(process.cwd(), file)));

if (missing.length > 0) {
  console.error("Missing scaffold files:");
  missing.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log("Smoke test passed: scaffold files and standalone architecture files are present.");
