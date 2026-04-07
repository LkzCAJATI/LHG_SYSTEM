import { create } from 'zustand';
import { useStore } from './useStore';

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
  
  setServerConfig: (ip: string, port: number) => void;
  addClient: (client: NetworkClient) => void;
  updateClient: (id: string, updates: Partial<NetworkClient>) => void;
  removeClient: (id: string) => void;
  toggleClient: (id: string) => void;
  shutdownClient: (id: string) => void;
  restartClient: (id: string) => void;
  setConnected: (connected: boolean) => void;
  lockDevice: (id: string) => void;
  unlockDevice: (id: string) => void;
  shutdownDevice: (id: string) => void;
  restartDevice: (id: string) => void;
  isDeviceConnected: (id: string) => boolean;
  startServer: () => void;
  stopServer: () => void;
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


export const useNetworkStore = create<NetworkState>((set, get) => ({
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
      // Opcional: adicionar como clientes pendentes se não existirem
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
        }
      }
    } finally {
      set({ isScanning: false });
    }
  },

  initializeIpc: async () => {
    if (typeof window !== 'undefined' && window.lhgSystem?.onNetworkEvent) {
      // Verificar status atual logo no início
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
      });

      // Ouvir pedidos de login de clientes remotos
      window.lhgSystem.onLoginRequest((data: any) => {
        const { deviceId, username, password } = data;
        const { customers, startSession } = useStore.getState();

        // Validar cliente
        const customer = customers.find(c => c.username === username && c.password === password);
        
        if (!customer) {
          window.lhgSystem?.sendLoginResponse({
            deviceId,
            success: false,
            message: 'Usuário ou senha incorretos.'
          });
          return;
        }

        // Verificar saldo (em minutos)
        if (!customer.credits || customer.credits <= 0) {
          window.lhgSystem?.sendLoginResponse({
            deviceId,
            success: false,
            message: 'Você não possui tempo disponível. Fale com o atendente.'
          });
          return;
        }

        // Tudo OK: Iniciar sessão
        try {
          startSession(deviceId, customer.name, customer.credits, 0, customer.id);
          
          window.lhgSystem?.sendLoginResponse({
            deviceId,
            success: true,
            message: 'Login realizado com sucesso!'
          });
        } catch (error) {
          window.lhgSystem?.sendLoginResponse({
            deviceId,
            success: false,
            message: 'Erro ao iniciar sessão no servidor.'
          });
        }
      });
    }
  },

  setServerConfig: (ip: string, port: number) => {
    set({ serverIP: ip, serverPort: port });
    localStorage.setItem('serverConfig', JSON.stringify({ ip, port }));
  },

  addClient: (client: NetworkClient) => {
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

  updateClient: (id: string, updates: Partial<NetworkClient>) => {
    set((state) => {
      const newClients = state.clients.map(c => c.id === id ? { ...c, ...updates } : c);
      return {
        clients: newClients,
        connectedClients: newClients.filter(c => c.connected)
      };
    });
  },

  removeClient: (id: string) => {
    set((state) => ({
      clients: state.clients.filter(c => c.id !== id),
      connectedClients: state.clients.filter(c => c.id !== id && c.connected)
    }));
  },

  toggleClient: (id: string) => {
    const client = get().clients.find(c => c.id === id);
    if (client) {
      if (client.locked) get().unlockDevice(id);
      else get().lockDevice(id);
    }
  },

  shutdownClient: (id: string) => {
    window.lhgSystem?.sendNetworkCommand({ deviceId: id, command: { type: 'shutdown' } });
    get().updateClient(id, { connected: false, lastSeen: new Date().toISOString() });
  },

  restartClient: (id: string) => {
    window.lhgSystem?.sendNetworkCommand({ deviceId: id, command: { type: 'restart' } });
  },

  setConnected: (connected: boolean) => {
    set({ connected });
  },

  lockDevice: (id: string) => {
    window.lhgSystem?.sendNetworkCommand({ deviceId: id, command: { type: 'lock' } });
    set((state) => ({
      clients: state.clients.map(c => c.id === id ? { ...c, locked: true } : c)
    }));
  },

  unlockDevice: (id: string) => {
    window.lhgSystem?.sendNetworkCommand({ deviceId: id, command: { type: 'unlock' } });
    set((state) => ({
      clients: state.clients.map(c => c.id === id ? { ...c, locked: false } : c)
    }));
  },

  shutdownDevice: (id: string) => {
    get().shutdownClient(id);
  },

  restartDevice: (id: string) => {
    get().restartClient(id);
  },

  isDeviceConnected: (id: string) => {
    const client = get().clients.find(c => c.id === id);
    return client?.connected || false;
  },

  startServer: () => {
    set({ isServerRunning: true, connected: true });
  },

  stopServer: () => {
    set({ isServerRunning: false, connected: false });
  },

  approveClient: (id: string, name: string) => {
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

  rejectClient: (id: string) => {
    set((state) => ({
      pendingClients: state.pendingClients.filter(c => c.id !== id)
    }));
  },

  startRemoteDesktop: (id: string) => {
    set({ remoteDesktopSession: id });
  },

  stopRemoteDesktop: () => {
    set({ remoteDesktopSession: null });
  }
}));
