export {};

declare global {
  interface Window {
    lhgSystem?: {
      loadState: () => Promise<{
        version: number;
        updatedAt: string;
        appState: Record<string, unknown>;
        settingsState: Record<string, unknown>;
      } | null>;
      saveState: (payload: {
        appState: Record<string, unknown>;
        settingsState: Record<string, unknown>;
      }) => Promise<{ ok: boolean; error?: string }>;
      createBackup: () => Promise<{ ok: boolean; backupPath?: string | null; error?: string }>;
      getInfo: () => Promise<{ version: string; dataFile: string }>;
      quitApp: () => Promise<void>;
      sendNetworkCommand: (params: { deviceId: string; command: any }) => Promise<{ ok: boolean; error?: string }>;
      onNetworkEvent: (callback: (event: any) => void) => () => void;
      getLocalIp: () => Promise<string>;
      scanNetwork: () => Promise<string[]>;
      getServerStatus: () => Promise<boolean>;
      startNetworkServer: () => Promise<{ ok: boolean; running: boolean; error?: string }>;
      stopNetworkServer: () => Promise<{ ok: boolean; running: boolean; error?: string }>;
      wakeOnLan: (mac: string) => Promise<{ ok: boolean; error?: string }>;
      onLoginRequest: (callback: (data: any) => void) => () => void;
      sendLoginResponse: (data: { deviceId: string; success: boolean; message?: string }) => void;
      broadcastWallpaper: (data: { url: string }) => void;
      broadcastLogo: (data: { url: string }) => void;
      // Remote desktop helpers
      getScreenSources: () => Promise<Array<{ id: string; name: string }>>;
      sendRemoteInput: (data: { deviceId: string; input: any }) => Promise<{ ok: boolean; error?: string }>;
      onRemoteInput: (callback: (data: any) => void) => () => void;
      executeRemoteInput: (input: any) => void;
      setWindowMode: (data: { mode: 'kiosk' | 'floating' }) => Promise<void>;
      syncSessions: (payload: {
        devices: any[];
        systemName?: string;
        logo?: string | null;
      } | any[]) => void;
      notifyMobile: (payload: { type: string; ok?: boolean; message?: string }) => void;
      /** Cupom térmico RAW (Windows). */
      printEscPos: (payload: {
        mode: 'coupon' | 'test';
        sale?: any;
        settings?: Record<string, unknown>;
        printerName?: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      setClientAdminMode: (data: { enabled: boolean }) => Promise<{ ok: boolean; error?: string }>;
      requestSystemShutdown: () => Promise<{ ok: boolean; error?: string }>;
      docs?: {
        select: () => Promise<Array<{ path: string; name: string }> | null>;
        save: (data: { sourcePath: string; originalName: string }) => Promise<{ ok: boolean; filename: string; path: string; error?: string }>;
        open: (filename: string) => Promise<{ ok: boolean; error?: string }>;
        read: (filename: string) => Promise<{ ok: boolean; data?: Uint8Array; error?: string }>;
      };
    };
  }
}
