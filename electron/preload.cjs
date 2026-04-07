const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lhgSystem", {
  loadState: () => ipcRenderer.invoke("lhg:state:load"),
  saveState: (payload) => ipcRenderer.invoke("lhg:state:save", payload),
  createBackup: () => ipcRenderer.invoke("lhg:state:backup"),
  getInfo: () => ipcRenderer.invoke("lhg:info")
});
