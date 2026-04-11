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
  /** Nome exato da fila no Windows (Painel de Impressão). Vazio = padrão. */
  thermalPrinterName: string;
  /** Cupom PDV via ESC/POS RAW no app Windows (recomendado para POS-58). */
  thermalEscPos: boolean;
  
  // Rede
  serverHost: string;
  serverPort: number;
  
  // Outros
  currency: string;
  lowStockAlert: number;
  stockDeductionPolicy: 'on_approval' | 'on_service_start' | 'on_completion';

  
  // Modelos de Documentos
  saleContractTemplate: string;
  /** Prestação de serviços / reparo (Fluxo OS). */
  repairContractTemplate: string;
  purchaseContractTemplate: string;
  osTermsTemplate: string;
  budgetRulesTemplate: string;
  serviceAuthTemplate: string;
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
  thermalPrinterName: '',
  thermalEscPos: true,
  serverHost: 'localhost',
  serverPort: 8080,
  currency: 'R$',
  lowStockAlert: 5,
  stockDeductionPolicy: 'on_approval',
  saleContractTemplate: `CONTRATO DE COMPRA E VENDA PARCELADA\n\nPelo presente instrumento particular, as partes abaixo identificadas:\nVENDEDOR: {{LOJA}}\nCLIENTE (Comprador): {{CLIENTE}}\nCPF: {{CPF}}\n\ntêm entre si justo e contratado o seguinte:\n\nCLÁUSULA 1 – DO OBJETO\nO presente contrato tem como objeto a compra de {{OBJETO}} em perfeito funcionamento, testado no ato da entrega.\n\nCLÁUSULA 2 – DO VALOR\nO valor total do produto é de {{VALOR_TOTAL}}.\n\nCLÁUSULA 3 – DA FORMA DE PAGAMENTO\nO cliente pagará o valor da seguinte forma:\n{{FORMA_PAGAMENTO}}.\n\nCLÁUSULA 4 – DA ENTREGA DO PRODUTO\nO produto será entregue ao CLIENTE após o pagamento.\n\nCLÁUSULA 5 – DA GARANTIA\nO produto possui garantia de 90 dias contra defeitos de funcionamento, não cobrindo:\nMau uso;\nQuedas;\nDanos elétricos;\nInstalação de programas indevidos;\nViolação do lacre da loja.\n\nCLÁUSULA 6 – DA INADIMPLêNCIA\nO não pagamento de 2 parcelas consecutivas poderá resultar na cobrança administrativa ou judicial do débito.\n\nCLÁUSULA 7 – DA QUITAÇÃO\nApós o pagamento total do valor acordado, será emitido recibo de quitação total, encerrando-se as obrigações entre as partes.\n\nCLÁUSULA 9 – DO FORO\nFica eleito o foro da comarca de Cajati/SP para dirimir quaisquer dúvidas oriundas deste contrato.\nE por estarem de acordo, assinam o presente contrato em duas vias de igual teor.\n\nLocal: Av. dos Trabalhadores, 59 - Centro - CAJATI/SP\nData: {{DATA}}`,
  repairContractTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: {{CLIENTE}} — CPF: {{CPF}}\nPRESTADOR: {{LOJA}}\n\nCLÁUSULA 1 – DO OBJETO\nPrestação de serviços técnicos de reparo/manutenção referente a: {{OBJETO}}.\n\nCLÁUSULA 2 – DO VALOR\nValor total: {{VALOR_TOTAL}}.\n\nCLÁUSULA 3 – DA FORMA DE PAGAMENTO\n{{FORMA_PAGAMENTO}}\n\nCLÁUSULA 4 – DA GARANTIA\n{{GARANTIA}}\n\nCLÁUSULA 5 – DA INADIMPLêNCIA / MULTA\n{{INADIMPLENCIA}}\n\nData: {{DATA}}`,
  purchaseContractTemplate: `CONTRATO DE RECOMPRA DE EQUIPAMENTO\n\nVENDEDOR: {{CLIENTE}}\nCOMPRADOR: {{LOJA}}\n\nOBJETO: Compra de {{OBJETO}} pela loja pelo valor de {{VALOR_TOTAL}} como parte de pagamento ou compra direta.`,
  osTermsTemplate: `REGRAS DE ORÇAMENTO / CONSERTO
- Este orçamento possui validade de até 7 dias após a data de emissão.
- O serviço será iniciado somente após aprovação do orçamento e pagamento de entrada mínima de 50% do valor total.
- Serviços técnicos realizados não poderão ser desfeitos.
- Cancelamentos após o início do serviço poderão gerar cobrança proporcional ao trabalho executado.
- Em caso de peças ou produtos encomendados, o valor da entrada não é reembolsável em caso de desistência.
- O aparelho permanecerá retido até a quitação total do valor do serviço.
- Após a conclusão do serviço, o cliente terá prazo máximo de 30 dias para retirada do aparelho.
- Após esse prazo poderá ser cobrada taxa de armazenamento.
- Após 90 dias sem retirada e sem contato, o aparelho poderá ser considerado abandonado para ressarcimento dos custos do serviço.
- Garantia de 3 meses para defeitos relacionados exclusivamente ao serviço realizado.
- A garantia não cobre mau uso, quedas, oxidação, violação do aparelho ou problemas não relacionados ao serviço executado.
- A loja não se responsabiliza por dados não salvos no aparelho.
- Serviços serão realizados somente mediante solicitação, autorização, pagamento e retirada por pessoa maior de 18 anos.
- O aparelho será entregue somente ao titular do orçamento mediante quitação total do serviço.`,
  budgetRulesTemplate: `REGRAS DE PAGAMENTO
- Aceitamos: PIX, dinheiro, cartões de crédito/débito.
- Parcelamentos no cartão sob consulta, podendo incluir acréscimos de taxas.`,
  serviceAuthTemplate: `AUTORIZAÇÃO DE SERVIÇO
Declaro que li e concordo com todos os termos deste orçamento para realização dos serviços ou reparos.`
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
      name: 'lhg-settings',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { settings?: Partial<SystemSettings> } | undefined;
        const persistedSettings = persisted?.settings ?? {};
        const mergedSettings: SystemSettings = {
          ...defaultSettings,
          ...persistedSettings,
        };
        if (typeof mergedSettings.thermalEscPos !== 'boolean') {
          mergedSettings.thermalEscPos = defaultSettings.thermalEscPos;
        }
        if (typeof mergedSettings.thermalPrinterName !== 'string') {
          mergedSettings.thermalPrinterName = defaultSettings.thermalPrinterName;
        }

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
