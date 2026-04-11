const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

contextBridge.exposeInMainWorld("lhgSystem", {
  loadState: () => ipcRenderer.invoke("lhg:state:load"),
  saveState: (payload) => ipcRenderer.invoke("lhg:state:save", payload),
  createBackup: () => ipcRenderer.invoke("lhg:state:backup"),
  getInfo: () => ipcRenderer.invoke("lhg:info"),
  quitApp: () => ipcRenderer.invoke("lhg:app:quit"),
  copy: (text) => ipcRenderer.send('lhg:app:copy', text),
  docs: {
    select: () => ipcRenderer.invoke('lhg:docs:select'),
    save: (data) => ipcRenderer.invoke('lhg:docs:save', data),
    open: (filename) => ipcRenderer.invoke('lhg:docs:open', { filename }),
    read: (filename) => ipcRenderer.invoke('lhg:docs:read', { filename }),
  },
  setClientAdminMode: (data) => ipcRenderer.invoke('lhg:client:set-admin', data),
  requestSystemShutdown: () => ipcRenderer.invoke('lhg:client:system-shutdown'),
  
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
  startNetworkServer: () => ipcRenderer.invoke("lhg:network:start-server"),
  stopNetworkServer: () => ipcRenderer.invoke("lhg:network:stop-server"),
  wakeOnLan: (mac) => ipcRenderer.invoke("lhg:network:wol", { mac }),
  
  // Handlers de Login Remoto
  onLoginRequest: (callback) => ipcRenderer.on("lhg:network:login-request", (_, data) => callback(data)),
  sendLoginResponse: (data) => ipcRenderer.send("lhg:network:login-response", data),
  
  // Acesso Remoto
  getScreenSources: async () => {
    try {
      if (desktopCapturer?.getSources) {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 0, height: 0 }
        });
        return sources.map(s => ({ id: s.id, name: s.name }));
      }
    } catch {}
    // Fallback (caso desktopCapturer não esteja disponível por algum motivo)
    return ipcRenderer.invoke("lhg:remote:get-sources");
  },
  sendRemoteInput: (data) => ipcRenderer.invoke("lhg:remote:input", data),
  onRemoteInput: (callback) => ipcRenderer.on("lhg:remote:input", (_, data) => callback(data)),
  executeRemoteInput: (input) => ipcRenderer.send("lhg:remote:execute-input", { input }),
  
  // Handlers de Visual/Janela
  broadcastWallpaper: (data) => ipcRenderer.send("lhg:network:broadcast-wallpaper", data),
  broadcastLogo: (data) => ipcRenderer.send("lhg:network:broadcast-logo", data),
  setWindowMode: (data) => ipcRenderer.invoke("lhg:window:setMode", data),
  syncSessions: (payload) => ipcRenderer.send("lhg:network:sync-sessions", payload),
  notifyMobile: (payload) => ipcRenderer.send("lhg:mobile:notify", payload),

  /** Térmica ESC/POS RAW (Windows). `mode`: "coupon" | "test" */
  printEscPos: (payload) => ipcRenderer.invoke("lhg:print:escpos", payload)
});
