import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import { ServiceOrder } from '../types';
import { format } from 'date-fns';
import { generateOSPDF } from '../utils/pdfGenerator';

export default function ServiceOrders() {
  const { serviceOrders, addServiceOrder, updateServiceOrder, deleteServiceOrder, convertOSToBudget } = useStore();
  const { settings } = useSettingsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados do Formulário
  const [customerName, setCustomerName] = useState('');
  const [customerCPF, setCustomerCPF] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState<ServiceOrder['deviceType']>('pc');
  const [deviceBrandModel, setDeviceBrandModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [physicalState, setPhysicalState] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isOver18, setIsOver18] = useState(false);

  const availableServices = [
    'Diagnóstico para identificar o problema',
    'Formatação',
    'Limpeza completa',
    'Troca de pasta térmica',
    'Atualização de drivers',
    'Troca de peças'
  ];

  const handleCreateOS = () => {
    if (!customerName || !deviceBrandModel) {
      alert('Por favor, preencha o nome do cliente e o modelo do aparelho.');
      return;
    }

    addServiceOrder({
      customerName,
      customerCPF,
      customerPhone,
      isOver18,
      deviceType,
      deviceBrandModel,
      serialNumber,
      physicalState,
      selectedServices,
      status: 'open',
    });

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerCPF('');
    setCustomerPhone('');
    setDeviceType('pc');
    setDeviceBrandModel('');
    setSerialNumber('');
    setPhysicalState('');
    setSelectedServices([]);
    setIsOver18(false);
  };

  const handleToggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const handleAttachDocument = async (osId: string) => {
    if (!window.lhgSystem?.docs) return;
    
    const file = await window.lhgSystem.docs.select();
    if (file) {
      const result = await window.lhgSystem.docs.save({ sourcePath: file.path, originalName: file.name });
      if (result.ok) {
        const os = serviceOrders.find(o => o.id === osId);
        const currentAttachments = os?.attachments || [];
        updateServiceOrder(osId, { attachments: [...currentAttachments, result.filename] });
        alert('Documento anexado com sucesso!');
      }
    }
  };

  const filteredOS = serviceOrders.filter(os => 
    os.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.externalId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🛠️</span> Ordens de Serviço (OS)
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <span>➕</span> Nova OS
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por cliente ou Nº da OS..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Lista de OS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOS.map((os) => (
          <div key={os.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-purple-500 transition shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="bg-purple-900/50 text-purple-300 text-xs px-2 py-1 rounded-md mb-1 inline-block">
                  #{os.externalId}
                </span>
                <h3 className="text-white font-bold text-lg">{os.customerName}</h3>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                os.status === 'open' ? 'bg-yellow-900/40 text-yellow-400' :
                os.status === 'analyzing' ? 'bg-blue-900/40 text-blue-400' :
                os.status === 'ready' ? 'bg-green-900/40 text-green-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {os.status === 'open' ? 'Aberto' : os.status === 'analyzing' ? 'Análise' : os.status === 'ready' ? 'Pronto' : 'Entregue'}
              </span>
            </div>

            <div className="text-sm text-gray-400 mb-4 space-y-1">
              <p>📱 {os.deviceType.toUpperCase()} - {os.deviceBrandModel}</p>
              <p>📅 {format(new Date(os.createdAt), 'dd/MM/yyyy')}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => generateOSPDF(os, settings, 'print')}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                title="Imprimir"
              >
                🖨️
              </button>
              <button
                onClick={() => handleAttachDocument(os.id)}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                title="Anexar Documento Assinado"
              >
                📎 ({os.attachments?.length || 0})
              </button>
              {os.status === 'open' && (
                <button
                  onClick={() => convertOSToBudget(os.id)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition"
                >
                  Gerar Orçamento
                </button>
              )}
              {os.attachments && os.attachments.length > 0 && (
                <button
                  onClick={() => window.lhgSystem?.docs?.open(os.attachments![0])}
                  className="px-3 py-1 bg-green-600/20 text-green-400 text-sm rounded-lg transition border border-green-900"
                >
                  Ver Assinatura
                </button>
              )}
            </div>
            
            <button
               onClick={() => deleteServiceOrder(os.id)}
               className="mt-4 text-xs text-red-500 hover:text-red-400"
            >
              Remover OS
            </button>
          </div>
        ))}
      </div>

      {/* Modal Nova OS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl p-6 border border-gray-700 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nova Ordem de Serviço</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Cliente */}
              <div className="space-y-4">
                <h4 className="text-purple-400 text-sm font-bold uppercase tracking-wider">Dados do Cliente</h4>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">CPF</label>
                    <input
                      type="text"
                      value={customerCPF}
                      onChange={(e) => setCustomerCPF(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Telefone</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input type="checkbox" checked={isOver18} onChange={() => setIsOver18(!isOver18)} className="rounded bg-gray-700 border-gray-600" />
                  Sou maior de 18 anos
                </label>
              </div>

              {/* Aparelho */}
              <div className="space-y-4">
                <h4 className="text-purple-400 text-sm font-bold uppercase tracking-wider">Dados do Aparelho</h4>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Tipo</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as any)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="pc">PC</option>
                    <option value="notebook">Notebook</option>
                    <option value="console">Console</option>
                    <option value="celular">Celular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Marca/Modelo</label>
                  <input
                    type="text"
                    value={deviceBrandModel}
                    onChange={(e) => setDeviceBrandModel(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Nº de Série</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-400 text-xs mb-1 font-bold uppercase tracking-wider text-purple-400">Estado Físico / Acessórios</label>
              <textarea
                value={physicalState}
                onChange={(e) => setPhysicalState(e.target.value)}
                placeholder="Ex: Risco na lateral, sem fonte, controle com drift..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white h-20"
              />
            </div>

            <div className="mb-6">
              <h4 className="text-purple-400 text-sm font-bold uppercase tracking-wider mb-3">Serviços Solicitados</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableServices.map(service => (
                  <label key={service} className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer hover:bg-gray-700 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service)}
                      onChange={() => handleToggleService(service)}
                      className="rounded bg-gray-700 border-gray-600 text-purple-600"
                    />
                    {service}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOS}
                className="flex-2 px-8 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition"
              >
                Criar Ordem de Serviço
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
