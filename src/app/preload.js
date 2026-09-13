const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appApi', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
