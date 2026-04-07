const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lhgSystem", {
  loadState: () => ipcRenderer.invoke("lhg:state:load"),
  saveState: (payload) => ipcRenderer.invoke("lhg:state:save", payload),
  createBackup: () => ipcRenderer.invoke("lhg:state:backup"),
  getInfo: () => ipcRenderer.invoke("lhg:info"),
  quitApp: () => ipcRenderer.invoke("lhg:app:quit"),
  
  // Handlers de Rede
  sendNetworkCommand: (command) => ipcRenderer.invoke("lhg:network:command", command),
  onNetworkEvent: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on("lhg:network:event", subscription);
    return () => ipcRenderer.removeListener("lhg:network:event", subscription);
  },
  getLocalIp: () => ipcRenderer.invoke("lhg:network:ip"),
  scanNetwork: () => ipcRenderer.invoke("lhg:network:scan"),
  getServerStatus: () => ipcRenderer.invoke("lhg:network:get-server-status"),
  
  // Handlers de Login Remoto
  onLoginRequest: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on("lhg:network:login-request", subscription);
    return () => ipcRenderer.removeListener("lhg:network:login-request", subscription);
  },
  sendLoginResponse: (data) => ipcRenderer.send("lhg:network:login-response", data),
  
  // Handlers de Visual/Janela
  broadcastWallpaper: (data) => ipcRenderer.send("lhg:network:broadcast-wallpaper", data),
  setWindowMode: (data) => ipcRenderer.invoke("lhg:window:setMode", data)
});
