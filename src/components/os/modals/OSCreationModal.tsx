import { useState } from 'react';
import { ServiceOrder } from '../../../types';
import { AttachmentManager } from './AttachmentManager';
import { useSettingsStore } from '../../../store/settingsStore';
import { generateOSPDF } from '../../../utils/pdfGenerator';

interface Props {
  os?: ServiceOrder;
  users: Array<{id: string, name: string, prefix?: string}>;
  currentUser: any;
  onSave: (data: Partial<ServiceOrder>, technicianId: string) => Promise<void>;
  onClose: () => void;
  onAttach: (category: string, files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
}

export function OSCreationModal({ os, users, currentUser, onSave, onClose, onAttach, onRemoveAttachment }: Props) {
  const { settings } = useSettingsStore();
  const [customerName, setCustomerName] = useState(os?.customerName || '');
  const [customerCPF, setCustomerCPF] = useState(os?.customerCPF || '');
  const [customerPhone, setCustomerPhone] = useState(os?.customerPhone || '');
  const [deviceType, setDeviceType] = useState<any>(os?.deviceType || 'pc');
  const [deviceBrandModel, setDeviceBrandModel] = useState(os?.deviceBrandModel || '');
  const [serialNumber, setSerialNumber] = useState(os?.serialNumber || '');
  const [physicalState, setPhysicalState] = useState(os?.physicalState || '');
  const [customerComplaint, setCustomerComplaint] = useState(os?.customerComplaint || '');
  const [selectedServices, setSelectedServices] = useState<string[]>(os?.selectedServices || []);
  const [selectedUserId, setSelectedUserId] = useState<string>(os?.userId || currentUser?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  // Consider changes
  const hasChanges = true; // For creation/edit we can just enable it, or compare properly

  const handleSave = async () => {
    if (!customerName || !deviceBrandModel) {
      alert("Nome do cliente e Modelo do aparelho são obrigatórios.");
      return;
    }
    if (!selectedUserId) {
      alert("Selecione o técnico/responsável para gerar a OS com o prefixo correto.");
      return;
    }
    setIsSaving(true);
    await onSave({
      customerName,
      customerCPF,
      customerPhone,
      deviceType,
      deviceBrandModel,
      serialNumber,
      physicalState,
      customerComplaint,
      selectedServices,
      status: os?.status || 'aberta'
    }, selectedUserId);
    setIsSaving(false);
  };

  const handleToggleService = (s: string) => {
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const services = [
    'Diagnóstico', 'Formatação', 'Limpeza Física', 'Backup', 'Troca de Peça'
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-4xl p-6 shadow-2xl mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">📄 {os ? `Editar OS #${os.externalId}` : 'Criar Nova OS'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
           <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase text-purple-400 mb-2">Dados do Cliente</h4>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do Cliente *" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              <div className="flex gap-2">
                 <input value={customerCPF} onChange={e => setCustomerCPF(e.target.value)} placeholder="CPF" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
                 <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Telefone" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              </div>

              <h4 className="text-sm font-bold uppercase text-purple-400 mb-2 mt-4">Dados do Aparelho</h4>
              <div className="flex gap-2">
                 <select value={deviceType} onChange={e => setDeviceType(e.target.value as any)} className="w-1/3 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                    <option value="pc">Desktop</option>
                    <option value="notebook">Notebook</option>
                    <option value="console">Console</option>
                 </select>
                 <input value={deviceBrandModel} onChange={e => setDeviceBrandModel(e.target.value)} placeholder="Marca / Modelo *" className="w-2/3 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
              <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="S/N (Número de Série)" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              
              <label className="block text-xs uppercase text-gray-400">Estado Físico / Avarias (Checklist)</label>
              <textarea value={physicalState} onChange={e => setPhysicalState(e.target.value)} placeholder="Riscos, amassados, parafusos faltando..." className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[60px]" />
           </div>

           <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase text-purple-400 mb-2">Motivo / Problema</h4>
              <textarea value={customerComplaint} onChange={e => setCustomerComplaint(e.target.value)} placeholder="Relato do cliente..." className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[100px]" />

              <h4 className="text-sm font-bold uppercase text-purple-400 mb-2">Serviços Solicitados Inicialmente</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {services.map((s) => (
                   <button 
                     key={s} 
                     onClick={() => handleToggleService(s)}
                     className={`px-3 py-1 text-sm rounded ${selectedServices.includes(s) ? 'bg-purple-600 text-white font-bold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                   >
                     {s}
                   </button>
                ))}
              </div>

              <div>
                <label className="block text-xs uppercase text-gray-400 mb-1">Técnico / Responsável pela Entrada</label>
                <select 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                >
                  <option value="">Selecione quem está recebendo</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} {u.prefix ? `(Prefixo ${u.prefix})` : ''}</option>
                  ))}
                </select>
                {selectedUserId && (
                   <p className="mt-2 text-xs text-gray-400">
                     A OS será gerada com o prefixo selecionado (Ex: {users.find(u => u.id === selectedUserId)?.prefix}-XX).
                   </p>
                )}
              </div>

              {os && (
                 <AttachmentManager 
                   attachments={os.attachmentsByCategory?.os || []}
                   category="os"
                   onAdd={async (files) => await onAttach('os', files)}
                   onRemove={onRemoveAttachment}
                   title="Arquivos Iniciais (Fotos de Aparelho)"
                 />
              )}
           </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
           <button onClick={onClose} className="flex-[1] py-3 bg-gray-700 hover:bg-gray-600 transition text-white rounded-xl font-bold">CANCELAR</button>
           {os && (
             <button
               onClick={() => generateOSPDF(os, settings, 'download')}
               className="flex-[1] py-3 bg-indigo-600 hover:bg-indigo-500 transition text-white rounded-xl font-bold"
               title="Baixar PDF da ficha técnica desta OS"
             >
               BAIXAR FICHA
             </button>
           )}
           <button 
             onClick={handleSave} 
             disabled={isSaving || !hasChanges}
             className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition text-white rounded-xl font-extrabold shadow-lg shadow-purple-900/50"
           >
             {isSaving ? "SALVANDO..." : "SALVAR ALTERAÇÕES DA OS"}
           </button>
        </div>
      </div>
    </div>
  );
}
