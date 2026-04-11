const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require("electron");
const http = require("http");
// Garante que o caminho de dados seja o mesmo para dev e prod
app.name = "LHG SYSTEM";

const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const os = require("os");
const net = require("net");
const fs = require("fs");
const fsp = require("fs/promises");
const { autoUpdater } = require("electron-updater");
const { WebSocketServer, WebSocket } = require("ws");
const dgram = require("dgram");

let wss = null;
let httpServer = null;
const connectedSockets = new Map(); // deviceId -> socket
const mobileSockets = new Set();
let mainWindow = null;
let lastMobileSyncData = null;
/** Logo (data URL) enviada pelo renderer em sync-sessions; usada no ícone PWA /pwa-icon.png */
let lastMobileLogoDataUrl = null;

let allowClientQuit = false;
let allowClientFileAccess = false;
let currentInstallMode = "server";
/** Windows: tenta capturar Ctrl+Shift+Esc no modo kiosk (não impede Gerenciador de Tarefas por outros meios). */
let clientKioskEscShortcut = false;

function registerClientKioskShortcuts() {
  if (currentInstallMode !== "client" || clientKioskEscShortcut) return;
  if (process.platform !== "win32") return;
  try {
    globalShortcut.register("CommandOrControl+Shift+Escape", () => {});
    clientKioskEscShortcut = true;
  } catch (e) {
    console.warn("LHG kiosk shortcut:", e && e.message);
  }
}

function unregisterClientKioskShortcuts() {
  if (!clientKioskEscShortcut) return;
  try {
    globalShortcut.unregister("CommandOrControl+Shift+Escape");
  } catch {}
  clientKioskEscShortcut = false;
}
const DATA_VERSION = 1;
const DATA_DIR_NAME = "lhg-data";
const DATA_FILE_NAME = "state.json";
const BACKUP_DIR_NAME = "backups";

function getDataPaths() {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, DATA_DIR_NAME);
  const dataFile = path.join(dataDir, DATA_FILE_NAME);
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  const docsDir = path.join(dataDir, "lhg_documentos");
  return { dataDir, dataFile, backupDir, docsDir };
}

async function ensureDataDirs() {
  const { dataDir, backupDir, docsDir } = getDataPaths();
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(backupDir, { recursive: true });
  await fsp.mkdir(docsDir, { recursive: true });
}

function migrateStoredPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    version: typeof raw.version === "number" ? raw.version : DATA_VERSION,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    appState: raw.appState ?? {},
    settingsState: raw.settingsState ?? {}
  };
}

async function readStateFromDisk() {
  const { dataFile } = getDataPaths();
  if (!fs.existsSync(dataFile)) return null;
  const content = await fsp.readFile(dataFile, "utf8");
  const parsed = JSON.parse(content);
  return migrateStoredPayload(parsed);
}

async function writeStateToDisk(payload) {
  await ensureDataDirs();
  const { dataFile } = getDataPaths();
  const finalPayload = {
    version: DATA_VERSION,
    updatedAt: new Date().toISOString(),
    appState: payload?.appState ?? {},
    settingsState: payload?.settingsState ?? {}
  };
  const tmp = `${dataFile}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(finalPayload, null, 2), "utf8");
  await fsp.rename(tmp, dataFile);
  return finalPayload;
}

async function createBackup() {
  const { dataFile, backupDir } = getDataPaths();
  if (!fs.existsSync(dataFile)) return null;
  await ensureDataDirs();
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const backupPath = path.join(backupDir, `state-${stamp}.json`);
  await fsp.copyFile(dataFile, backupPath);
  return backupPath;
}

function registerIpcHandlers() {
  ipcMain.handle("lhg:client:set-admin", async (_, { enabled }) => {
    allowClientFileAccess = Boolean(enabled);
    return { ok: true };
  });

  /** Desligamento do Windows solicitado pelo servidor (comando WebSocket no modo cliente). */
  ipcMain.handle("lhg:client:system-shutdown", async () => {
    if (currentInstallMode !== "client") {
      return { ok: false, error: "Somente no modo cliente." };
    }
    const { execFile } = require("child_process");
    return await new Promise((resolve) => {
      if (process.platform === "win32") {
        execFile(
          "shutdown",
          ["/s", "/t", "20", "/c", "LHG SYSTEM: desligamento remoto pelo servidor."],
          { windowsHide: true },
          (err) => resolve(err ? { ok: false, error: String(err.message || err) } : { ok: true })
        );
      } else {
        resolve({ ok: false, error: "Desligamento remoto disponivel apenas no Windows." });
      }
    });
  });

  const isFileAccessAllowed = () => {
    // No modo server, sempre permite.
    if (currentInstallMode !== "client") return true;
    // No modo client, só permite se admin liberou explicitamente.
    return allowClientFileAccess === true;
  };

  ipcMain.handle("lhg:state:load", async () => {
    try {
      return await readStateFromDisk();
    } catch {
      return null;
    }
  });

  ipcMain.handle("lhg:state:save", async (_, payload) => {
    try {
      await writeStateToDisk(payload);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("lhg:state:backup", async () => {
    try {
      const backupPath = await createBackup();
      return { ok: true, backupPath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("lhg:info", async () => {
    const { dataFile } = getDataPaths();
    return {
      version: app.getVersion(),
      dataFile
    };
  });

  /** Cupom térmico via ESC/POS RAW (Windows). Evita raster em branco do Chrome em drivers POS-58. */
  ipcMain.handle("lhg:print:escpos", async (_, payload) => {
    if (process.platform !== "win32") {
      return { ok: false, error: "Impressao ESC/POS RAW disponivel apenas no Windows." };
    }
    try {
      const { buildSaleCoupon, buildTestReceipt } = require("./escpos-build.cjs");
      const mode = payload?.mode === "test" ? "test" : "coupon";
      const printerName = typeof payload?.printerName === "string" ? payload.printerName.trim() : "";
      let buf;
      if (mode === "test") {
        buf = await buildTestReceipt(payload?.settings || {});
      } else {
        buf = await buildSaleCoupon(payload?.sale, payload?.settings || {});
      }
      if (!buf || buf.length === 0) {
        return { ok: false, error: "Buffer ESC/POS vazio." };
      }

      const tmpBin = path.join(app.getPath("temp"), `lhg-escpos-${Date.now()}.bin`);
      await fsp.writeFile(tmpBin, buf);

      const scriptDest = path.join(app.getPath("temp"), "lhg-print-raw.ps1");
      const scriptSrc = path.join(__dirname, "print-raw.ps1");
      await fsp.copyFile(scriptSrc, scriptDest);

      await new Promise((resolve, reject) => {
        const args = [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptDest,
          "-BinPath",
          tmpBin
        ];
        if (printerName) {
          args.push("-PrinterName", printerName);
        }
        execFile(
          "powershell.exe",
          args,
          { windowsHide: true, timeout: 120000 },
          (err, stdout, stderr) => {
            fsp.unlink(tmpBin).catch(() => {});
            if (err) {
              reject(new Error(stderr || err.message || String(err)));
            } else {
              resolve();
            }
          }
        );
      });

      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });

  ipcMain.handle("lhg:app:quit", async () => {
    allowClientQuit = true;
    app.quit();
  });

  ipcMain.handle("lhg:network:command", async (_, { deviceId, command }) => {
    const ws = connectedSockets.get(deviceId);
    if (ws && ws.readyState === 1) { // 1 = OPEN
      ws.send(JSON.stringify(command));
      return { ok: true };
    }
    return { ok: false, error: "Dispositivo não encontrado ou offline" };
  });

  ipcMain.handle("lhg:network:ip", async () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  });

  ipcMain.handle("lhg:network:scan", async () => {
    /**
     * Antes: TCP na porta 8080 — só o *servidor* LHG escuta 8080; PCs cliente só fazem
     * conexão de saída para o servidor, então nunca apareciam na varredura.
     * Agora: ping em /24 para cada IPv4 local (host ativo na LAN). Firewall pode bloquear ICMP.
     */
    const interfaces = os.networkInterfaces();
    const localIps = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIps.push(iface.address);
        }
      }
    }

    const targets = new Set();
    for (const localIp of localIps) {
      if (!localIp || localIp.startsWith("127.")) continue;
      const parts = localIp.split(".");
      if (parts.length !== 4) continue;
      const prefix = parts.slice(0, 3).join(".");
      for (let i = 1; i < 255; i++) {
        const ip = `${prefix}.${i}`;
        if (ip === localIp) continue;
        targets.add(ip);
      }
    }

    if (targets.size === 0) return [];

    const pingOne = async (ip) => {
      try {
        if (process.platform === "win32") {
          await execFileAsync("ping", ["-n", "1", "-w", "500", ip], {
            windowsHide: true,
            timeout: 6000,
            maxBuffer: 64 * 1024,
          });
        } else if (process.platform === "darwin") {
          await execFileAsync("/sbin/ping", ["-c", "1", "-W", "500", ip], {
            timeout: 6000,
            maxBuffer: 64 * 1024,
          });
        } else {
          await execFileAsync("ping", ["-c", "1", "-W", "1", ip], {
            timeout: 6000,
            maxBuffer: 64 * 1024,
          });
        }
        return ip;
      } catch {
        return null;
      }
    };

    const list = Array.from(targets);
    const found = [];
    const batchSize = 36;
    for (let i = 0; i < list.length; i += batchSize) {
      const chunk = list.slice(i, i + batchSize);
      const results = await Promise.all(chunk.map(pingOne));
      for (const ip of results) {
        if (ip) found.push(ip);
      }
    }
    return found;
  });

  ipcMain.handle("lhg:network:get-server-status", () => {
    return !!wss;
  });

  ipcMain.handle("lhg:network:start-server", async () => {
    try {
      if (mainWindow) {
        setupNetworkServer(mainWindow);
        setupMobileHttpServer();
      }
      return { ok: true, running: !!wss };
    } catch (error) {
      return { ok: false, error: String(error), running: !!wss };
    }
  });

  ipcMain.handle("lhg:network:stop-server", async () => {
    try {
      if (wss) {
        try {
          wss.clients?.forEach((client) => {
            try { client.close(); } catch {}
          });
        } catch {}
        await new Promise((resolve) => wss.close(() => resolve(true)));
        wss = null;
      }

      if (httpServer) {
        await new Promise((resolve) => httpServer.close(() => resolve(true)));
        httpServer = null;
      }

      connectedSockets.clear();
      mobileSockets.clear();
      return { ok: true, running: false };
    } catch (error) {
      return { ok: false, error: String(error), running: !!wss };
    }
  });

  ipcMain.handle("lhg:window:setMode", async (_, { mode }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return;

    if (mode === "kiosk") {
      win.setKiosk(true);
      win.setAlwaysOnTop(true, "screen-saver");
      win.setFullScreen(true);
      win.setResizable(false);
      win.setSkipTaskbar(true);
      try {
        win.setContentProtection(true);
      } catch {}
      registerClientKioskShortcuts();
    } else if (mode === "floating") {
      const { screen } = require("electron");
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width } = primaryDisplay.workAreaSize;

      unregisterClientKioskShortcuts();
      try {
        win.setContentProtection(false);
      } catch {}
      win.setKiosk(false);
      win.setFullScreen(false);
      win.setResizable(false);
      win.setSkipTaskbar(true);
      // Janela compacta sem borda, transparente, sempre no topo
      win.setSize(280, 64);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      // Canto superior direito com margem de 12px
      win.setPosition(width - 292, 12);
      win.setBackgroundColor("#00000000");
    }
  });

  ipcMain.on("lhg:network:broadcast-wallpaper", (_, { url }) => {
    connectedSockets.forEach((socket) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "wallpaper_update",
          url
        }));
      }
    });
  });

  ipcMain.on("lhg:network:broadcast-logo", (_, { url }) => {
    connectedSockets.forEach((socket) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "logo_update",
          url
        }));
      }
    });
  });

  ipcMain.on("lhg:network:login-response", (_, { deviceId, success, message }) => {
    const socket = connectedSockets.get(deviceId);
    if (socket && socket.readyState === 1) { // 1 = OPEN
      socket.send(JSON.stringify({
        type: "login_response",
        success,
        message
      }));
    }
  });

  // Novos handlers para Acesso Remoto
  ipcMain.handle("lhg:remote:get-sources", async () => {
    try {
      // Em Electron, o desktopCapturer é mais confiável no preload/renderer.
      // Mantemos este handler apenas como fallback para compatibilidade.
      const { desktopCapturer } = require("electron");
      if (!desktopCapturer?.getSources) return [];
      const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } });
      return sources.map(s => ({ id: s.id, name: s.name }));
    } catch {
      return [];
    }
  });

  ipcMain.handle("lhg:remote:input", async (_, { deviceId, input }) => {
    const ws = connectedSockets.get(deviceId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "remote_input", input }));
      return { ok: true };
    }
    return { ok: false, error: "Offline" };
  });

  ipcMain.handle("lhg:network:wol", async (_, { mac }) => {
    try {
      if (!mac) return { ok: false, error: "MAC não fornecido" };
      
      const cleanMac = mac.replace(/[:-\s]/g, "");
      if (cleanMac.length !== 12) return { ok: false, error: "MAC inválido" };

      const macBuffer = Buffer.from(cleanMac, "hex");
      const magicPacket = Buffer.alloc(102);
      magicPacket.fill(0xff, 0, 6);
      for (let i = 0; i < 16; i++) {
        macBuffer.copy(magicPacket, (i + 1) * 6);
      }

      const client = dgram.createSocket("udp4");
      client.bind(() => {
        client.setBroadcast(true);
        // Envia para broadcast da subrede (ex: 192.168.1.255) ou global (255.255.255.255)
        client.send(magicPacket, 0, magicPacket.length, 9, "255.255.255.255", (err) => {
          client.close();
        });
      });
      
      console.log(`Pacote WoL enviado para: ${mac}`);
      return { ok: true };
    } catch (error) {
      console.error("Erro WoL:", error);
      return { ok: false, error: String(error) };
    }
  });

  // Executar input localmente (quando este PC for o cliente recebendo comando do servidor)
  ipcMain.on("lhg:remote:execute-input", (_, { input }) => {
    const { type, x, y, key } = input;
    
    // Usando PowerShell para simular input sem dependências nativas pesadas
    let psCommand = "";
    if (type === "mousemove" || type === "mousedown" || type === "mouseup") {
      const clickType = type === "mousedown" ? "0x0002" : (type === "mouseup" ? "0x0004" : "0x0001");
      psCommand = `
        $win32 = Add-Type -MemberDefinition @'
          [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
          [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
'@ -Name "Win32" -Namespace Win32 -PassThru
        [Win32.Win32]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
        if ("${type}" -ne "mousemove") {
          [Win32.Win32]::mouse_event(${clickType}, 0, 0, 0, 0)
        }
      `;
    } else if (type === "keydown") {
      // Simulação básica de teclado (pode ser expandida conforme necessário)
      psCommand = `[void][System.Windows.Forms.SendKeys]::SendWait("${key}")`;
    }

    if (psCommand) {
      const { exec } = require("child_process");
      exec(`powershell -Command "${psCommand.replace(/\n/g, "")}"`, (err) => {
        if (err) console.error("Erro ao executar input remoto:", err);
      });
    }
  });

  // Gestão de Documentos (Anexos)
  ipcMain.handle("lhg:docs:save", async (_, { sourcePath, originalName }) => {
    if (!isFileAccessAllowed()) {
      return { ok: false, error: "Acesso negado. Somente admin pode usar arquivos no modo cliente." };
    }
    try {
      await ensureDataDirs();
      const { docsDir } = getDataPaths();
      const ext = path.extname(originalName);
      const filename = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
      const destPath = path.join(docsDir, filename);
      
      await fsp.copyFile(sourcePath, destPath);
      return { ok: true, filename, path: destPath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("lhg:docs:open", async (_, { filename }) => {
    if (!isFileAccessAllowed()) {
      return { ok: false, error: "Acesso negado. Somente admin pode usar arquivos no modo cliente." };
    }
    const { docsDir } = getDataPaths();
    const fullPath = path.join(docsDir, filename);
    const { shell } = require("electron");
    await shell.openPath(fullPath);
    return { ok: true };
  });

  ipcMain.handle("lhg:docs:read", async (_, { filename }) => {
    if (!isFileAccessAllowed()) {
      return { ok: false, error: "Acesso negado. Somente admin pode usar arquivos no modo cliente." };
    }
    try {
      const { docsDir } = getDataPaths();
      const fullPath = path.join(docsDir, filename);
      const data = await fsp.readFile(fullPath);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

  ipcMain.handle("lhg:docs:select", async () => {
    if (!isFileAccessAllowed()) {
      return null;
    }
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Arquivos", extensions: ["pdf", "jpg", "png", "jpeg", "webp", "mp4", "mov", "mkv", "avi"] }
      ]
    });
    if (result.canceled) return null;
    return result.filePaths.map((p) => ({ path: p, name: path.basename(p) }));
  });

  ipcMain.on("lhg:mobile:notify", (_, payload) => {
    let raw;
    try {
      raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    } catch {
      return;
    }
    mobileSockets.forEach((s) => {
      try {
        if (s.readyState === 1) s.send(raw);
      } catch {}
    });
  });

  ipcMain.on("lhg:network:sync-sessions", (_, payload) => {
    const devices = Array.isArray(payload) ? payload : (payload?.devices || []);
    const systemName = Array.isArray(payload) ? "LHG SYSTEM" : (payload?.systemName || "LHG SYSTEM");
    const logo = Array.isArray(payload) ? null : (payload?.logo || null);
    lastMobileLogoDataUrl =
      typeof logo === "string" && logo.length > 0 ? logo : null;
    const syncData = JSON.stringify({
      type: "session_sync",
      devices,
      systemName,
      logo
    });
    lastMobileSyncData = syncData;
    
    mobileSockets.forEach(socket => {
      if (socket.readyState === 1) {
        socket.send(syncData);
      }
    });
  });
}

function setupNetworkServer(win) {
  if (wss) return; // Já está rodando

  try {
    wss = new WebSocketServer({ port: 8080 });
    
    wss.on("connection", (ws, req) => {
      const ip = req.socket.remoteAddress.replace(/^.*:/, "");
      
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "register") {
            ws.__deviceId = msg.deviceId;
            connectedSockets.set(msg.deviceId, ws);
            win.webContents.send("lhg:network:event", {
              type: "client_connected",
              deviceId: msg.deviceId,
              ip: ip,
              deviceName: msg.deviceName
            });
          }
          if (msg.type === "login_request") {
            // Repassar para o Renderer do Servidor validar
            win.webContents.send("lhg:network:login-request", {
              deviceId: msg.deviceId,
              username: msg.username,
              password: msg.password
            });
          }
          if (msg.type === "heartbeat") {
            win.webContents.send("lhg:network:event", {
              type: "client_heartbeat",
              deviceId: msg.deviceId,
              lastSeen: new Date().toISOString()
            });
          }
          if (msg.type === "desktop_ready") {
            win.webContents.send("lhg:network:event", {
              type: "desktop_ready",
              deviceId: msg.deviceId
            });
          }
          if (msg.type === "remote_frame") {
            const deviceId = msg.deviceId || ws.__deviceId;
            if (deviceId) {
              win.webContents.send("lhg:network:event", {
                type: "remote_frame",
                deviceId,
                frame: msg.frame
              });
            }
          }
          if (msg.type === "mobile_transfer_time") {
            // Aceitar apenas de sockets mobile já autenticados via mobile_sync
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_transfer_time",
                fromDeviceId: msg.fromDeviceId,
                toDeviceId: msg.toDeviceId
              });
            }
          }
          if (msg.type === "mobile_release_device") {
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_release_device",
                deviceId: msg.deviceId,
                durationMinutes: msg.durationMinutes
              });
            }
          }
          if (msg.type === "mobile_resume_session") {
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_resume_session",
                deviceId: msg.deviceId
              });
            }
          }
          if (msg.type === "mobile_end_session") {
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_end_session",
                deviceId: msg.deviceId
              });
            }
          }
          if (msg.type === "mobile_shutdown_pc") {
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_shutdown_pc",
                deviceId: msg.deviceId
              });
            }
          }
          if (msg.type === "mobile_wake_pc") {
            if (mobileSockets.has(ws)) {
              win.webContents.send("lhg:network:event", {
                type: "mobile_wake_pc",
                deviceId: msg.deviceId
              });
            }
          }
        } catch (e) {
          console.error("Erro WebSocket Message:", e);
        }
      });

      ws.on("close", () => {
        for (const [id, socket] of connectedSockets.entries()) {
          if (socket === ws) {
            connectedSockets.delete(id);
            win.webContents.send("lhg:network:event", {
              type: "client_disconnected",
              deviceId: id
            });
            break;
          }
        }
      });
    });

    console.log("Servidor WebSocket rodando na porta 8080");

    // Adicionar suporte para sincronização mobile no WebSocket existente
    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "mobile_sync") {
            mobileSockets.add(ws);
            ws.on("close", () => mobileSockets.delete(ws));
            // Envia o último snapshot imediatamente ao conectar
            if (lastMobileSyncData && ws.readyState === WebSocket.OPEN) {
              ws.send(lastMobileSyncData);
            }
          }
        } catch (e) {}
      });
    });

  } catch (err) {
    console.error("Falha ao iniciar Servidor WebSocket:", err);
  }
}

function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const trimmed = dataUrl.trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const header = trimmed.slice(0, comma);
  const body = trimmed.slice(comma + 1);
  const mimeMatch = /^data:([^;,]+)/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1].trim().split(";")[0] : "image/png";
  if (!/^image\//i.test(mime)) return null;
  if (/;base64/i.test(header)) {
    try {
      const buf = Buffer.from(body.replace(/\s/g, ""), "base64");
      return buf.length ? { mime, buf } : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getLogoDataUrlForPwa() {
  if (lastMobileLogoDataUrl) return lastMobileLogoDataUrl;
  try {
    const { dataFile } = getDataPaths();
    if (!fs.existsSync(dataFile)) return null;
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    const logo = raw?.settingsState?.settings?.logo;
    return typeof logo === "string" && logo.length > 0 ? logo : null;
  } catch {
    return null;
  }
}

function servePwaIcon(res) {
  const dataUrl = getLogoDataUrlForPwa();
  const parsed = dataUrl ? parseDataUrlImage(dataUrl) : null;
  if (parsed) {
    res.writeHead(200, {
      "Content-Type": parsed.mime,
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(parsed.buf);
    return;
  }
  const fallback = path.join(__dirname, "..", "mobile", "icon-192.png");
  fs.readFile(fallback, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    });
    res.end(content);
  });
}

function setupMobileHttpServer() {
  if (httpServer) return;

  httpServer = http.createServer((req, res) => {
    const mobileRoot = path.join(__dirname, "..", "mobile");
    const rawPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
    let rel = rawPath === "/" || rawPath === "" ? "index.html" : rawPath.replace(/^\/+/, "");
    if (rel === "pwa-icon.png") {
      servePwaIcon(res);
      return;
    }
    if (rel.includes("..") || path.isAbsolute(rel)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let filePath = path.join(mobileRoot, rel);
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(mobileRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpg",
      ".mp3": "audio/mpeg"
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code == "ENOENT") {
          res.writeHead(404);
          res.end("File not found");
        } else {
          res.writeHead(500);
          res.end("Server Error: " + error.code);
        }
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content, "utf-8");
      }
    });
  });

  httpServer.listen(4000, "0.0.0.0", () => {
    console.log("Servidor Mobile HTTP rodando na porta 4000 (Acessível via IP do PC)");
  });
}

function getInstallMode() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve("server");
      return;
    }

    execFile(
      "reg",
      ["query", "HKCU\\Software\\LanHouseManagement", "/v", "InstallMode"],
      { windowsHide: true },
      (error, stdout) => {
        if (error || !stdout) {
          resolve("server");
          return;
        }

        const normalized = stdout.toLowerCase();
        if (normalized.includes("server")) {
          resolve("server");
          return;
        }

        if (normalized.includes("client")) {
          resolve("client");
          return;
        }

        resolve("server");
      }
    );
  });
}

async function createWindow() {
  const installMode = await getInstallMode();

  const isClient = installMode === "client";
  currentInstallMode = installMode;
  // Sempre começa travado no client.
  allowClientFileAccess = false;

  const win = new BrowserWindow({
    width: isClient ? 1366 : 1280,
    height: isClient ? 768 : 800,
    kiosk: isClient,
    autoHideMenuBar: isClient,
    alwaysOnTop: isClient,
    // Quando for client, inicia sem frame e transparente
    // (será controlado dinamicamente pelo setMode)
    frame: !isClient,
    transparent: isClient,
    backgroundColor: isClient ? "#00000000" : "#1a1a2e",
    skipTaskbar: isClient,
    resizable: !isClient,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });
  mainWindow = win;

  if (isClient) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });

    win.on("close", (e) => {
      if (!allowClientQuit) {
        e.preventDefault();
      }
    });
  }

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
    query: { installMode }
  });

  if (installMode === "server") {
    setupNetworkServer(win);
    setupMobileHttpServer();
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  const configuredUrl = process.env.LHG_UPDATE_URL;
  if (configuredUrl) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: configuredUrl
    });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", () => {
    // Silencioso: se o provedor de update não estiver configurado, não quebra o app.
  });

  autoUpdater.on("update-downloaded", async () => {
    allowClientQuit = true;
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // Sem provider configurado por enquanto.
  });

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Falha de rede/update não deve interromper o sistema.
    });
  }, 15 * 60 * 1000);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  setupAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  unregisterClientKioskShortcuts();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
