import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from './useStore';
import { resolveWsDeviceId } from '../utils/resolveWsDeviceId';

export interface NetworkClient {
  id: string;
  name: string;
  ip: string;
  connected: boolean;
  locked: boolean;
  timeRemaining?: number;
  lastSeen?: string;
  status?: 'online' | 'offline';
  deviceName?: string;
  connectedAt?: string;
  os?: string;
}

interface NetworkState {
  clients: NetworkClient[];
  connected: boolean;
  serverIP: string;
  serverPort: number;
  isServerRunning: boolean;
  connectedClients: NetworkClient[];
  pendingClients: NetworkClient[];
  remoteDesktopSession: string | null;
  wakeOnLan: (mac: string) => Promise<void>;
  
  setServerConfig: (ip: string, port: number) => void;
  addClient: (client: NetworkClient) => void;
  updateClient: (id: string, updates: Partial<NetworkClient>) => void;
  removeClient: (id: string) => void;
  toggleClient: (id: string) => void;
  shutdownClient: (id: string) => void;
  restartClient: (id: string) => void;
  setConnected: (connected: boolean) => void;
  lockDevice: (id: string) => Promise<void>;
  unlockDevice: (id: string) => Promise<void>;
  shutdownDevice: (id: string) => Promise<void>;
  restartDevice: (id: string) => Promise<void>;
  isDeviceConnected: (id: string) => boolean;
  /** ID usado no WebSocket (ex.: pc-01) a partir do id do aparelho no cadastro */
  resolveCommandTargetId: (serverDeviceId: string) => string | null;
  sendDeviceCommand: (serverDeviceId: string, command: unknown) => Promise<{ ok: boolean; error?: string }>;
  sendPcUnlockStartSession: (
    serverDeviceId: string,
    sessionId: string,
    durationMinutes: number
  ) => Promise<{ ok: boolean; error?: string }>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  approveClient: (id: string, name: string) => void;
  rejectClient: (id: string) => void;
  startRemoteDesktop: (id: string) => void;
  stopRemoteDesktop: () => void;
  initializeIpc: () => void;
  isScanning: boolean;
  detectedIp: string | null;
  detectIp: () => Promise<void>;
  scanNetwork: () => Promise<void>;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      clients: [],
      connected: false,
      serverIP: '192.168.1.100',
      serverPort: 8080,
      isServerRunning: false,
      connectedClients: [],
      pendingClients: [],
      remoteDesktopSession: null,
      isScanning: false,
      detectedIp: null,

      detectIp: async () => {
        if (window.lhgSystem?.getLocalIp) {
          const ip = await window.lhgSystem.getLocalIp();
          set({ detectedIp: ip, serverIP: ip });
        }
      },

      scanNetwork: async () => {
        if (get().isScanning || !window.lhgSystem?.scanNetwork) return;
        set({ isScanning: true });
        try {
          const foundIps = await window.lhgSystem.scanNetwork();
          console.log('Scan results:', foundIps);
          for (const ip of foundIps) {
            const alreadyExists = get().clients.some(c => c.ip === ip);
            if (!alreadyExists) {
                get().addClient({
                    id: `detected-${ip.replace(/\./g, '-')}`,
                    name: `PC Detectado (${ip})`,
                    ip: ip,
                    connected: true,
                    locked: true,
                    lastSeen: new Date().toISOString()
                });
            } else {
              // Já existe, marcar como conectado se estiver online no scan
              const client = get().clients.find(c => c.ip === ip);
              if (client) get().updateClient(client.id, { connected: true });
            }
          }
        } finally {
          set({ isScanning: false });
        }
      },

      initializeIpc: async () => {
        if (typeof window !== 'undefined' && window.lhgSystem?.onNetworkEvent) {
          if (window.lhgSystem?.getServerStatus) {
            const isRunning = await window.lhgSystem.getServerStatus();
            if (isRunning) {
              set({ isServerRunning: true, connected: true });
            }
          }

          window.lhgSystem.onNetworkEvent((event: any) => {
            console.log('Network Event received:', event);
            if (event.type === 'client_connected') {
              get().addClient({
                id: event.deviceId,
                name: event.deviceName || event.deviceId,
                ip: event.ip,
                connected: true,
                locked: true,
                lastSeen: new Date().toISOString()
              });
            }
            if (event.type === 'client_heartbeat') {
              get().updateClient(event.deviceId, { connected: true, lastSeen: event.lastSeen });
            }
            if (event.type === 'client_disconnected') {
              get().updateClient(event.deviceId, { connected: false });
            }
            if (event.type === 'desktop_ready') {
              console.log('Desktop ready received for:', event.deviceId);
              const { activateSession } = useStore.getState();
              activateSession(event.deviceId);
            }
            if (event.type === 'mobile_transfer_time') {
              const fromId = String(event.fromDeviceId ?? '').trim();
              const toId = String(event.toDeviceId ?? '').trim();
              const { transferTimeBetweenDevices } = useStore.getState();
              const res = transferTimeBetweenDevices({
                fromDeviceId: fromId,
                toDeviceId: toId
              });
              if (!res.ok) {
                console.warn('Falha ao transferir tempo (mobile):', res.error);
              } else {
                void pushTimeTransferNetworkSync(fromId, toId);
              }
            }
            if (event.type === 'mobile_release_device') {
              const { devices, startSession } = useStore.getState();
              const deviceId = event.deviceId as string;
              const rawMins = Number(event.durationMinutes);
              const durationMinutes = Math.max(5, Math.min(24 * 60, Number.isFinite(rawMins) ? rawMins : 60));
              const device = devices.find((d) => d.id === deviceId);
              if (!device || device.status !== 'available') {
                console.warn('mobile_release_device: aparelho não disponível', deviceId);
                return;
              }
              const hours = durationMinutes / 60;
              startSession(deviceId, 'Celular', hours, 0, undefined);
              if (device.type === 'pc' && get().isDeviceConnected(deviceId)) {
                const updated = useStore.getState().devices.find((d) => d.id === deviceId);
                const newSession = updated?.currentSession;
                if (newSession?.id) {
                  void get().sendPcUnlockStartSession(deviceId, newSession.id, durationMinutes);
                }
              }
            }
            if (event.type === 'mobile_resume_session') {
              const { devices, resumeSession } = useStore.getState();
              const deviceId = event.deviceId as string;
              const device = devices.find((d) => d.id === deviceId);
              const sid = device?.currentSession?.id;
              if (!device || device.status !== 'paused' || !sid) {
                console.warn('mobile_resume_session: sessão pausada não encontrada', deviceId);
                return;
              }
              resumeSession(sid);
              if (device.type === 'pc' && get().isDeviceConnected(deviceId)) {
                void get().sendDeviceCommand(deviceId, { type: 'resume' });
              }
            }
            if (event.type === 'mobile_end_session') {
              const { devices, endSessionSavingTime } = useStore.getState();
              const deviceId = event.deviceId as string;
              const device = devices.find((d) => d.id === deviceId);
              const sid = device?.currentSession?.id;
              if (
                !device ||
                !sid ||
                (device.status !== 'in_use' && device.status !== 'paused')
              ) {
                console.warn('mobile_end_session: sem sessão ativa', deviceId);
                return;
              }
              if (device.type === 'pc' && get().isDeviceConnected(deviceId)) {
                void get().sendDeviceCommand(deviceId, { type: 'end_session' });
              }
              endSessionSavingTime(sid);
            }
            if (event.type === 'mobile_shutdown_pc') {
              const { devices, endSessionSavingTime } = useStore.getState();
              const deviceId = event.deviceId as string;
              const device = devices.find((d) => d.id === deviceId);
              if (!device || device.type !== 'pc') {
                console.warn('mobile_shutdown_pc: somente PC', deviceId);
                return;
              }
              const sid = device?.currentSession?.id;
              const active =
                device.status === 'in_use' || device.status === 'paused';
              if (active && sid) {
                void get().sendDeviceCommand(deviceId, { type: 'end_session' });
                endSessionSavingTime(sid);
              }
              void get().sendDeviceCommand(deviceId, { type: 'shutdown' });
            }
            if (event.type === 'mobile_wake_pc') {
              void (async () => {
                const { devices } = useStore.getState();
                const deviceId = event.deviceId as string;
                const device = devices.find((d) => d.id === deviceId);
                const notify = (ok: boolean, message: string) =>
                  window.lhgSystem?.notifyMobile?.({ type: 'server_toast', ok, message });
                if (!device || device.type !== 'pc') {
                  notify(false, 'Somente PCs podem receber Wake-on-LAN.');
                  return;
                }
                const mac = device.mac;
                if (!mac || typeof mac !== 'string') {
                  notify(false, 'Cadastre o MAC do PC em Dispositivos no servidor.');
                  return;
                }
                const res = await window.lhgSystem?.wakeOnLan(mac);
                if (res?.ok) {
                  notify(
                    true,
                    'Pacote WoL enviado. Aguarde o PC ligar (energia e WoL na BIOS/rede).'
                  );
                } else {
                  notify(false, res?.error || 'Falha ao enviar Wake-on-LAN.');
                }
              })();
            }
          });

          window.lhgSystem.onLoginRequest((data: any) => {
            const { deviceId, username, password } = data;
            const { customers, startSession, devices } = useStore.getState();
            const customer = customers.find(c => c.username === username && c.password === password);
            
            if (!customer) {
              window.lhgSystem?.sendLoginResponse({
                deviceId, success: false, message: 'Usuário ou senha incorretos.'
              });
              return;
            }

            if (!customer.credits || customer.credits <= 0) {
              window.lhgSystem?.sendLoginResponse({
                deviceId, success: false, message: 'Você não possui tempo disponível.'
              });
              return;
            }

            const dev =
              devices.find((d) => d.id === deviceId) ||
              devices.find((d) => (d.networkClientId || '').trim() === deviceId);
            if (!dev) {
              window.lhgSystem?.sendLoginResponse({
                deviceId,
                success: false,
                message: 'Este PC não está cadastrado no servidor (ID não encontrado).',
              });
              return;
            }

            try {
              const creditMinutes = Math.max(1, Math.floor(Number(customer.credits) || 0));
              const hours = creditMinutes / 60;
              startSession(dev.id, customer.name, hours, 0, customer.id);
              const newSession = useStore.getState().devices.find((d) => d.id === dev.id)?.currentSession;
              if (newSession?.id && get().isDeviceConnected(dev.id)) {
                void get().sendPcUnlockStartSession(dev.id, newSession.id, creditMinutes);
              }
              window.lhgSystem?.sendLoginResponse({
                deviceId, success: true, message: 'Login realizado com sucesso!'
              });
            } catch (error) {
              window.lhgSystem?.sendLoginResponse({
                deviceId, success: false, message: 'Erro ao iniciar sessão.'
              });
            }
          });
        }
      },

      setServerConfig: (ip, port) => {
        set({ serverIP: ip, serverPort: port });
      },

      addClient: (client) => {
        set((state) => {
          const exists = state.clients.find(c => c.id === client.id);
          if (exists) {
            const updatedClients = state.clients.map(c => 
              c.id === client.id ? { ...c, ...client, connected: true } : c
            );
            return {
              clients: updatedClients,
              connectedClients: updatedClients.filter(c => c.connected)
            };
          }
          const newClients = [...state.clients, { ...client, connected: true }];
          return { 
            clients: newClients,
            connectedClients: newClients.filter(c => c.connected)
          };
        });
      },

      updateClient: (id, updates) => {
        set((state) => {
          const newClients = state.clients.map(c => c.id === id ? { ...c, ...updates } : c);
          return {
            clients: newClients,
            connectedClients: newClients.filter(c => c.connected)
          };
        });
      },

      removeClient: (id) => {
        set((state) => ({
          clients: state.clients.filter(c => c.id !== id),
          connectedClients: state.clients.filter(c => c.id !== id && c.connected)
        }));
      },

      toggleClient: async (id) => {
        const client = get().clients.find(c => c.id === id);
        if (client) {
          if (client.locked) await get().unlockDevice(id);
          else await get().lockDevice(id);
        }
      },

      shutdownClient: async (id) => {
        const res = await get().sendDeviceCommand(id, { type: 'shutdown' });
        if (!res?.ok) {
          alert(res?.error || 'Falha ao enviar comando para o PC (offline).');
          return;
        }
        const target = get().resolveCommandTargetId(id) || id;
        get().updateClient(target, { connected: false, lastSeen: new Date().toISOString() });
      },

      restartClient: async (id) => {
        const res = await get().sendDeviceCommand(id, { type: 'restart' });
        if (!res?.ok) {
          alert(res?.error || 'Falha ao enviar comando para o PC (offline).');
        }
      },

      setConnected: (connected) => set({ connected }),

      resolveCommandTargetId: (serverDeviceId) => {
        return resolveWsDeviceId(serverDeviceId, useStore.getState().devices, get().clients);
      },

      sendDeviceCommand: async (serverDeviceId, command) => {
        const send = window.lhgSystem?.sendNetworkCommand;
        if (!send) return { ok: false, error: 'Somente no app servidor (Electron).' };
        const target = get().resolveCommandTargetId(serverDeviceId);
        if (!target) {
          return {
            ok: false,
            error:
              'PC não conectado ou ID não encontrado. Use o mesmo ID no cadastro do aparelho que no cliente (ex.: pc-01), ou preencha "ID no cliente" / IP fixo.',
          };
        }
        return send({ deviceId: target, command });
      },

      sendPcUnlockStartSession: async (serverDeviceId, sessionId, durationMinutes) => {
        const r1 = await get().sendDeviceCommand(serverDeviceId, { type: 'unlock' });
        if (!r1.ok) return r1;
        await new Promise((r) => setTimeout(r, 120));
        return get().sendDeviceCommand(serverDeviceId, {
          type: 'start_session',
          sessionId,
          duration: durationMinutes,
        });
      },

      lockDevice: async (id) => {
        const res = await get().sendDeviceCommand(id, { type: 'lock' });
        if (!res?.ok) {
          alert(res?.error || 'Falha ao bloquear (PC offline).');
          return;
        }
        const target = get().resolveCommandTargetId(id);
        if (target) get().updateClient(target, { locked: true });
      },

      unlockDevice: async (id) => {
        const res = await get().sendDeviceCommand(id, { type: 'unlock' });
        if (!res?.ok) {
          alert(res?.error || 'Falha ao liberar (PC offline).');
          return;
        }
        const target = get().resolveCommandTargetId(id);
        if (target) get().updateClient(target, { locked: false });
      },

      shutdownDevice: async (id) => get().shutdownClient(id),
      restartDevice: async (id) => get().restartClient(id),

      isDeviceConnected: (id) => {
        const wsId = get().resolveCommandTargetId(id);
        if (!wsId) return false;
        const client = get().clients.find((c) => c.id === wsId);
        return client?.connected || false;
      },

      startServer: async () => {
        if (window.lhgSystem?.startNetworkServer) {
          const res = await window.lhgSystem.startNetworkServer();
          if (!res.ok) alert(res.error || 'Falha ao iniciar servidor.');
          set({ isServerRunning: res.running, connected: res.running });
          return;
        }
        // Fallback (dev/web): apenas marca
        set({ isServerRunning: true, connected: true });
      },
      stopServer: async () => {
        if (window.lhgSystem?.stopNetworkServer) {
          const res = await window.lhgSystem.stopNetworkServer();
          if (!res.ok) alert(res.error || 'Falha ao parar servidor.');
          set({ isServerRunning: res.running, connected: res.running });
          return;
        }
        set({ isServerRunning: false, connected: false });
      },

      approveClient: (id, name) => {
        set((state) => {
          const client = state.pendingClients.find(c => c.id === id);
          if (!client) return state;
          
          const approvedClient = { ...client, name, connected: true, status: 'online' as const };
          return {
            pendingClients: state.pendingClients.filter(c => c.id !== id),
            clients: [...state.clients, approvedClient],
            connectedClients: [...state.connectedClients, approvedClient]
          };
        });
      },

      rejectClient: (id) => {
        set((state) => ({
          pendingClients: state.pendingClients.filter(c => c.id !== id)
        }));
      },

      startRemoteDesktop: (id) => set({ remoteDesktopSession: id }),
      stopRemoteDesktop: () => set({ remoteDesktopSession: null }),

      wakeOnLan: async (mac) => {
        if (window.lhgSystem?.wakeOnLan) {
          await window.lhgSystem.wakeOnLan(mac);
        }
      }
    }),
    {
      name: 'lhg-network-storage',
      partialize: (state) => ({
        clients: state.clients,
        serverIP: state.serverIP,
        serverPort: state.serverPort
      }),
    }
  )
);

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Após transferir tempo no store, alinha os PCs cliente: end_session primeiro (zera timer local),
 * depois unlock + start_session conforme o estado novo — evita dois tempos ativos por mensagens fora de ordem.
 */
export async function pushTimeTransferNetworkSync(fromDeviceId: string, toDeviceId: string) {
  const sendRaw = typeof window !== 'undefined' ? window.lhgSystem?.sendNetworkCommand : undefined;
  if (!sendRaw) return;

  const st = useNetworkStore.getState();
  const isConnected = st.isDeviceConnected;

  const syncOnePc = async (serverDeviceId: string) => {
    const nid = String(serverDeviceId ?? '').trim();
    let device = useStore.getState().devices.find((d) => String(d.id).trim() === nid);
    if (!device || device.type !== 'pc' || !isConnected(device.id)) return;

    const wsId = st.resolveCommandTargetId(device.id);
    if (!wsId) return;

    await sendRaw({ deviceId: wsId, command: { type: 'end_session' } });
    await delay(150);

    device = useStore.getState().devices.find((d) => String(d.id).trim() === nid);
    if (!device?.currentSession) return;

    const s = device.currentSession;
    const mins = Number(s.duration);
    if (!Number.isFinite(mins) || mins <= 0) return;

    await sendRaw({ deviceId: wsId, command: { type: 'unlock' } });
    await delay(80);
    await sendRaw({
      deviceId: wsId,
      command: { type: 'start_session', sessionId: s.id, duration: mins }
    });
  };

  await syncOnePc(fromDeviceId);
  await syncOnePc(toDeviceId);
}
