const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("meridian", {
  version: "1.0.0",

  license: {
    device: () => ipcRenderer.invoke("license:device"),
    check: () => ipcRenderer.invoke("license:check"),
    activate: (licenseKey) => ipcRenderer.invoke("license:activate", licenseKey),
    deactivate: () => ipcRenderer.invoke("license:deactivate"),
    onManualCheck: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("license:manual-check", listener);

      return () => {
        ipcRenderer.removeListener("license:manual-check", listener);
      };
    },
  },
});

contextBridge.exposeInMainWorld("settings", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (data) => ipcRenderer.invoke("settings:set", data),
});

contextBridge.exposeInMainWorld("entitlexWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
});