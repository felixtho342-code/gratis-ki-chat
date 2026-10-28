const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chatApp", {
  sendMessage: (messages) => ipcRenderer.invoke("chat:send", messages),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  }
});
