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
    };
  }
}
