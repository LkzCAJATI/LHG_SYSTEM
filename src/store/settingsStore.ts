import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemSettings {
  // Identidade
  systemName: string;
  logo: string | null;
  
  // Aparência
  systemBackground: string | null;
  clientWallpaper: string | null;
  
  // Preços
  pcPricePerHour: number;
  consolePricePerHour: number;
  fliperamaPricePerHour: number;
  extraControllerPrice: number;
  
  // Impressão
  printerType: 'thermal' | 'a4';
  receiptWidth: 58 | 80;
  
  // Rede
  serverHost: string;
  serverPort: number;
  
  // Outros
  currency: string;
  lowStockAlert: number;
}

interface SettingsStore {
  settings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  setLogo: (logo: string | null) => void;
  setSystemBackground: (background: string | null) => void;
  setClientWallpaper: (wallpaper: string | null) => void;
  setSystemName: (name: string) => void;
}

const defaultSettings: SystemSettings = {
  systemName: 'LHG SYSTEM',
  logo: null,
  systemBackground: null,
  clientWallpaper: null,
  pcPricePerHour: 5,
  consolePricePerHour: 6,
  fliperamaPricePerHour: 5,
  extraControllerPrice: 3,
  printerType: 'thermal',
  receiptWidth: 80,
  serverHost: 'localhost',
  serverPort: 8080,
  currency: 'R$',
  lowStockAlert: 5,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      setLogo: (logo) =>
        set((state) => ({
          settings: { ...state.settings, logo },
        })),
      setSystemBackground: (background) =>
        set((state) => ({
          settings: { ...state.settings, systemBackground: background },
        })),
      setClientWallpaper: (wallpaper) =>
        set((state) => ({
          settings: { ...state.settings, clientWallpaper: wallpaper },
        })),
      setSystemName: (name) =>
        set((state) => ({
          settings: { ...state.settings, systemName: name },
        })),
    }),
    {
      name: 'gamezone-settings',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { settings?: Partial<SystemSettings> } | undefined;
        const persistedSettings = persisted?.settings ?? {};
        const mergedSettings: SystemSettings = {
          ...defaultSettings,
          ...persistedSettings,
        };

        if (mergedSettings.systemName === 'GameZone Manager') {
          mergedSettings.systemName = 'LHG SYSTEM';
        }

        return {
          ...currentState,
          ...persisted,
          settings: mergedSettings,
        };
      },
    }
  )
);
