const { contextBridge, ipcRenderer } = require("electron");

console.log("PRELOAD RUN");

contextBridge.exposeInMainWorld("electron", {
  window: {
    minimize: () => ipcRenderer.invoke("win:minimize"),
    maximize: () => ipcRenderer.invoke("win:maximize"),
    close: () => ipcRenderer.invoke("win:close"),
    isMaximized: () => ipcRenderer.invoke("win:isMaximized"),
  },

  licenses: {
    list: () => ipcRenderer.invoke("licenses:list"),
    upsert: (row) => ipcRenderer.invoke("licenses:upsert", row),
    remove: (id) => ipcRenderer.invoke("licenses:remove", id),
  },
});