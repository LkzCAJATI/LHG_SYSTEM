const { app, BrowserWindow, dialog, ipcMain } = require("electron");
// Garante que o caminho de dados seja o mesmo para dev e prod
app.name = "LHG SYSTEM";

const path = require("path");
const { execFile } = require("child_process");
const os = require("os");
const net = require("net");
const fs = require("fs");
const fsp = require("fs/promises");
const { autoUpdater } = require("electron-updater");
const { WebSocketServer } = require("ws");

let wss = null;
const connectedSockets = new Map(); // deviceId -> socket

let allowClientQuit = false;
const DATA_VERSION = 1;
const DATA_DIR_NAME = "lhg-data";
const DATA_FILE_NAME = "state.json";
const BACKUP_DIR_NAME = "backups";

function getDataPaths() {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, DATA_DIR_NAME);
  const dataFile = path.join(dataDir, DATA_FILE_NAME);
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  return { dataDir, dataFile, backupDir };
}

async function ensureDataDirs() {
  const { dataDir, backupDir } = getDataPaths();
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(backupDir, { recursive: true });
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
    const interfaces = os.networkInterfaces();
    let localIp = null;
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp) break;
    }

    if (!localIp) return [];

    const subnet = localIp.split(".").slice(0, 3).join(".");
    const found = [];
    const tasks = [];

    // Tentar conectar na porta 8080 em toda a sub-rede /24
    for (let i = 1; i < 255; i++) {
      const ip = `${subnet}.${i}`;
      if (ip === localIp) continue;

      tasks.push(new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(250); // Timeout rápido
        socket.on("connect", () => {
          found.push(ip);
          socket.destroy();
          resolve(true);
        });
        socket.on("error", () => resolve(false));
        socket.on("timeout", () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(8080, ip);
      }));
    }

    await Promise.all(tasks);
    return found;
  });

  ipcMain.handle("lhg:network:get-server-status", () => {
    return !!wss;
  });

  ipcMain.on("lhg:network:login-response", (_, { deviceId, success, message }) => {
    const socket = connectedSockets.get(deviceId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "login_response",
        success,
        message
      }));
    }
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
  } catch (err) {
    console.error("Falha ao iniciar Servidor WebSocket:", err);
  }
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
  const win = new BrowserWindow({
    width: installMode === "client" ? 1366 : 1280,
    height: installMode === "client" ? 768 : 800,
    kiosk: installMode === "client",
    autoHideMenuBar: installMode === "client",
    alwaysOnTop: installMode === "client",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  if (installMode === "client") {
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
