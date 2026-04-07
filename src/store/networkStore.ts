import { create } from 'zustand';

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
  serverIp: string;
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
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  clients: [],
  connected: false,
  serverIP: '192.168.1.100',
  serverPort: 8080,
  isServerRunning: false,
  serverIp: '192.168.1.100',
  connectedClients: [],
  pendingClients: [],
  remoteDesktopSession: null,

  setServerConfig: (ip: string, port: number) => {
    set({ serverIP: ip, serverPort: port, serverIp: ip });
    localStorage.setItem('serverConfig', JSON.stringify({ ip, port }));
  },

  addClient: (client: NetworkClient) => {
    set((state) => {
      const exists = state.clients.find(c => c.id === client.id);
      if (exists) {
        return {
          clients: state.clients.map(c => c.id === client.id ? { ...c, ...client, connected: true, status: 'online' } : c),
          connectedClients: state.clients.filter(c => c.connected)
        };
      }
      const newClients = [...state.clients, { ...client, status: 'online' as const }];
      return { 
        clients: newClients,
        connectedClients: newClients.filter(c => c.connected)
      };
    });
  },

  updateClient: (id: string, updates: Partial<NetworkClient>) => {
    set((state) => ({
      clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c),
      connectedClients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c).filter(c => c.connected)
    }));
  },

  removeClient: (id: string) => {
    set((state) => ({
      clients: state.clients.filter(c => c.id !== id),
      connectedClients: state.clients.filter(c => c.id !== id && c.connected)
    }));
  },

  toggleClient: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, locked: !c.locked } : c
      )
    }));
  },

  shutdownClient: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, connected: false, status: 'offline', lastSeen: new Date().toISOString() } : c
      ),
      connectedClients: state.clients.filter(c => c.id !== id && c.connected)
    }));
  },

  restartClient: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, connected: false, status: 'offline', lastSeen: new Date().toISOString() } : c
      )
    }));
  },

  setConnected: (connected: boolean) => {
    set({ connected });
  },

  lockDevice: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, locked: true } : c
      )
    }));
  },

  unlockDevice: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, locked: false } : c
      )
    }));
  },

  shutdownDevice: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, connected: false, status: 'offline', lastSeen: new Date().toISOString() } : c
      ),
      connectedClients: state.clients.filter(c => c.id !== id && c.connected)
    }));
  },

  restartDevice: (id: string) => {
    set((state) => ({
      clients: state.clients.map(c => 
        c.id === id ? { ...c, connected: false, status: 'offline', lastSeen: new Date().toISOString() } : c
      )
    }));
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
