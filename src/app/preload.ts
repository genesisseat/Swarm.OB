import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("appApi", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
});

declare global {
  interface Window {
    appApi: {
      getVersion: () => Promise<string>;
    };
  }
}
