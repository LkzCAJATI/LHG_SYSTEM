import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SystemSettings {
  // Identidade
  systemName: string;
  logo: string | null;
  
  // Aparência
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
  
  // Modelos de Documentos
  saleContractTemplate: string;
  purchaseContractTemplate: string;
  osTermsTemplate: string;
  budgetRulesTemplate: string;
}

interface SettingsStore {
  settings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  setLogo: (logo: string | null) => void;
  setClientWallpaper: (wallpaper: string | null) => void;
  setSystemName: (name: string) => void;
}

const defaultSettings: SystemSettings = {
  systemName: 'LHG SYSTEM',
  logo: null,
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
  saleContractTemplate: `CONTRATO DE COMPRA E VENDA PARCELADA\n\nPelo presente instrumento particular, as partes abaixo identificadas:\nVENDEDOR: {{LOJA}}\nCLIENTE (Comprador): {{CLIENTE}}\nCPF: {{CPF}}\n\ntêm entre si justo e contratado o seguinte:\n\nCLÁUSULA 1 - DO OBJETO\nO presente contrato tem como objeto a compra de {{OBJETO}} em perfeito funcionamento.\n\nCLÁUSULA 2 - DO VALOR\nO valor total do produto é de {{VALOR_TOTAL}}.\n\nCLÁUSULA 3 - DA FORMA DE PAGAMENTO\nO cliente pagará o valor da seguinte forma: {{FORMA_PAGAMENTO}}.\n\nCLÁUSULA 5 - DA GARANTIA\nO produto possui garantia de 90 dias contra defeitos de funcionamento.`,
  purchaseContractTemplate: `CONTRATO DE RECOMPRA DE EQUIPAMENTO\n\nVENDEDOR: {{CLIENTE}}\nCOMPRADOR: {{LOJA}}\n\nOBJETO: Compra de {{OBJETO}} pela loja pelo valor de {{VALOR_TOTAL}} como parte de pagamento ou compra direta.`,
  osTermsTemplate: `REGRAS DE ORÇAMENTO / CONSERTO\n- Este orçamento possui validade de 7 dias.\n- O serviço será iniciado somente após aprovação e entrada mínima de 50%.\n- Garantia de 3 meses para defeitos relacionados exclusivamente ao serviço realizado.`,
  budgetRulesTemplate: `REGRAS DE PAGAMENTO\n- Aceitamos: PIX, Dinheiro, Cartão.\n- Parcelamentos no cartão sob consulta com acréscimo de taxas.`,
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
