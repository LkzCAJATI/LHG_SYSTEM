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
      onLoginRequest: (callback: (data: any) => void) => () => void;
      sendLoginResponse: (data: { deviceId: string; success: boolean; message?: string }) => void;
    };
  }
}
