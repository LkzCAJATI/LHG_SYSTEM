import { useState, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export default function Settings() {
  const { settings, updateSettings, setLogo, setClientWallpaper, setSystemName } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'prices' | 'documents' | 'printer' | 'advanced'>('appearance');
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string | null) => void,
    isClientWallpaper: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setter(result);
        if (isClientWallpaper && window.lhgSystem?.broadcastWallpaper) {
          window.lhgSystem.broadcastWallpaper({ url: result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id: 'appearance', label: '🎨 Aparência', icon: '🎨' },
    { id: 'prices', label: '💰 Preços', icon: '💰' },
    { id: 'documents', label: '📄 Documentos', icon: '📄' },
    { id: 'printer', label: '🖨️ Impressão', icon: '🖨️' },
    { id: 'advanced', label: '⚙️ Avançado', icon: '⚙️' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <span>⚙️</span> Configurações do Sistema
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-xl p-6">
        {/* Aparência */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">🎨 Identidade Visual</h3>

            {/* Nome do Sistema */}
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                📝 Nome do Sistema
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Ex: Minha LAN House"
                />
                <button
                  onClick={() => setSystemName('LHG SYSTEM')}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition"
                >
                  Resetar
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Nome exibido no menu lateral e nos recibos
              </p>
            </div>

            {/* Logo */}
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                🖼️ Logo do Sistema
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-500">
                  {settings.logo ? (
                    <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-400 text-xs text-center">Sem logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setLogo)}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <span>📤</span> Enviar Logo
                  </button>
                  {settings.logo && (
                    <button
                      onClick={() => setLogo(null)}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      🗑️ Remover Logo
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Aparece no menu, recibos, orçamentos e relatórios
              </p>
            </div>


            {/* Papel de Parede dos PCs */}
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                🖥️ Papel de Parede dos PCs Clientes
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-500">
                  {settings.clientWallpaper ? (
                    <img src={settings.clientWallpaper} alt="Wallpaper" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs text-center">Padrão</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={wallpaperInputRef}
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setClientWallpaper, true)}
                    className="hidden"
                  />
                  <button
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center justify-center gap-2 font-bold shadow-lg"
                  >
                    <span>📤</span> Atualizar e Enviar para PCs
                  </button>
                  {settings.clientWallpaper && (
                    <button
                      onClick={() => {
                        setClientWallpaper(null);
                        if (window.lhgSystem?.broadcastWallpaper) {
                          window.lhgSystem.broadcastWallpaper({ url: '' });
                        }
                      }}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      🗑️ Remover
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Imagem exibida na tela de bloqueio dos PCs clientes
              </p>
            </div>

            {/* Preview */}
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-3">
                👁️ Prévia do Menu
              </label>
              <div className="bg-gray-800 rounded-lg p-4 max-w-xs">
                <div className="flex items-center gap-3 mb-4">
                  {settings.logo ? (
                    <img src={settings.logo} alt="Logo" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-3xl">🎮</span>
                  )}
                  <div>
                    <h3 className="text-white font-bold text-sm">{settings.systemName}</h3>
                    <p className="text-gray-400 text-xs">Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preços */}
        {activeTab === 'prices' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">💰 Preços por Hora</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  🖥️ PC (por hora)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    value={settings.pcPricePerHour}
                    onChange={(e) => updateSettings({ pcPricePerHour: parseFloat(e.target.value) || 0 })}
                    className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  🎮 Console/PlayStation (por hora)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    value={settings.consolePricePerHour}
                    onChange={(e) => updateSettings({ consolePricePerHour: parseFloat(e.target.value) || 0 })}
                    className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  ⚡ Fliperama (por hora)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    value={settings.fliperamaPricePerHour}
                    onChange={(e) => updateSettings({ fliperamaPricePerHour: parseFloat(e.target.value) || 0 })}
                    className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  🎮 Controle Extra (por hora)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">R$</span>
                  <input
                    type="number"
                    value={settings.extraControllerPrice}
                    onChange={(e) => updateSettings({ extraControllerPrice: parseFloat(e.target.value) || 0 })}
                    className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                ⚠️ Alerta de Estoque Baixo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.lowStockAlert}
                  onChange={(e) => updateSettings({ lowStockAlert: parseInt(e.target.value) || 0 })}
                  className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  min="0"
                />
                <span className="text-gray-400">unidades</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Produtos com quantidade abaixo deste valor mostrarão alerta
              </p>
            </div>
          </div>
        )}

        {/* Documentos */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">📄 Modelos de Documentos</h3>
            
            <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4 mb-6">
              <h4 className="text-indigo-400 font-medium mb-2 flex items-center gap-2">
                <span>💡</span> Dica: Variáveis Dinâmicas
              </h4>
              <p className="text-gray-300 text-sm mb-2">
                Use as etiquetas abaixo no texto para que o sistema preencha automaticamente:
              </p>
              <div className="flex flex-wrap gap-2">
                {['LOJA', 'CLIENTE', 'VALOR_TOTAL', 'FORMA_PAGAMENTO', 'OBJETO'].map(tag => (
                  <code key={tag} className="bg-gray-800 text-purple-400 px-2 py-1 rounded text-xs">
                    {'{{' + tag + '}}'}
                  </code>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">📜 Contrato de Venda Parcelada</label>
                <textarea
                  value={settings.saleContractTemplate}
                  onChange={(e) => updateSettings({ saleContractTemplate: e.target.value })}
                  className="w-full h-48 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">🤝 Contrato de Recompra (Troca)</label>
                <textarea
                  value={settings.purchaseContractTemplate}
                  onChange={(e) => updateSettings({ purchaseContractTemplate: e.target.value })}
                  className="w-full h-48 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <label className="block text-gray-300 text-sm font-medium mb-2">🛠️ Termos de OS</label>
                  <textarea
                    value={settings.osTermsTemplate}
                    onChange={(e) => updateSettings({ osTermsTemplate: e.target.value })}
                    className="w-full h-32 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                  />
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <label className="block text-gray-300 text-sm font-medium mb-2">💳 Regras de Pagamento (Orçamento)</label>
                  <textarea
                    value={settings.budgetRulesTemplate}
                    onChange={(e) => updateSettings({ budgetRulesTemplate: e.target.value })}
                    className="w-full h-32 bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'printer' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">🖨️ Configurações de Impressão</h3>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-3">
                Tipo de Impressora
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="printerType"
                    checked={settings.printerType === 'thermal'}
                    onChange={() => updateSettings({ printerType: 'thermal' })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-white">Térmica</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="printerType"
                    checked={settings.printerType === 'a4'}
                    onChange={() => updateSettings({ printerType: 'a4' })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-white">A4</span>
                </label>
              </div>
            </div>

            {settings.printerType === 'thermal' && (
              <div className="bg-gray-700 rounded-lg p-4">
                <label className="block text-gray-300 text-sm font-medium mb-3">
                  Largura do Papel
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="receiptWidth"
                      checked={settings.receiptWidth === 58}
                      onChange={() => updateSettings({ receiptWidth: 58 })}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-white">58mm</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="receiptWidth"
                      checked={settings.receiptWidth === 80}
                      onChange={() => updateSettings({ receiptWidth: 80 })}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-white">80mm</span>
                  </label>
                </div>
              </div>
            )}

            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-3">
                📄 Testar Impressão
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  🖨️ Imprimir Página Atual
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Avançado */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚙️ Configurações Avançadas</h3>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                🌐 Servidor WebSocket
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs">Host</label>
                  <input
                    type="text"
                    value={settings.serverHost}
                    onChange={(e) => updateSettings({ serverHost: e.target.value })}
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Porta</label>
                  <input
                    type="number"
                    value={settings.serverPort}
                    onChange={(e) => updateSettings({ serverPort: parseInt(e.target.value) || 8080 })}
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                💱 Moeda
              </label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
                className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                placeholder="R$"
              />
            </div>

            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
              <h4 className="text-yellow-400 font-medium mb-2">⚠️ Zona de Perigo</h4>
              <p className="text-gray-300 text-sm mb-3">
                Essas ações são irreversíveis. Use com cuidado!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (confirm('Deseja resetar todas as configurações?')) {
                      localStorage.removeItem('gamezone-settings');
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  🔄 Resetar Configurações
                </button>
                <button
                  onClick={() => {
                    if (confirm('Deseja limpar todos os dados? Isso inclui vendas, produtos, clientes, etc.')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg transition"
                >
                  🗑️ Limpar Todos os Dados
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
