import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import { ServiceOrder, Budget } from '../types';
import { generateBudgetPDF, generateContractPDF } from '../utils/pdfGenerator';
import { OSCard } from './os/OSCard';
import { OSFlowModal } from './os/OSFlowModal';
import { OSCreationModal } from './os/modals/OSCreationModal';
import { DiagnosisModal } from './os/modals/DiagnosisModal';
import { BudgetModal } from './os/modals/BudgetModal';
import { ContractModal } from './os/modals/ContractModal';
import { PaymentModal } from './os/modals/PaymentModal';

type ActiveModal = 'os' | 'diagnosis' | 'budget' | 'contract' | 'payment' | null;

export default function ServiceOrders() {
  const {
    serviceOrders,
    users,
    currentUser,
    addServiceOrder,
    updateServiceOrder,
    setServiceOrderStatus,
    saveOSDiagnosis,
    generateOSContract,
    registerOSPayment,
    budgets,
    products,
    addBudget,
    updateBudget,
    addOSAttachment,
    addOSStageAttachment,
    removeOSStageAttachment
  } = useStore();
  
  const { settings } = useSettingsStore();

  const [internalSearch, setInternalSearch] = useState('');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeOSId, setActiveOSId] = useState<string | null>(null);
  const [showFlowId, setShowFlowId] = useState<string | null>(null);

  const filteredOS = serviceOrders.filter(os => 
    os.customerName.toLowerCase().includes(internalSearch.toLowerCase()) ||
    os.externalId.toLowerCase().includes(internalSearch.toLowerCase())
  );

  const handleAction = (modal: ActiveModal, osId: string | null) => {
    setActiveOSId(osId);
    setActiveModal(modal);
  };

  const handleCancelClick = (osId: string) => {
    if (confirm("Deseja CANCELAR esta O.S? (O cliente desistiu ou não aprovou)")) {
       setServiceOrderStatus(osId, 'canceled');
    }
  };

  const handleResumeClick = (osId: string) => {
    const os = serviceOrders.find(o => o.id === osId);
    if (!os) return;
    
    // Volta para o último status lógico antes do cancelamento (ou diagnóstigo por padrão)
    const prevStatus = os.diagnosis ? 'em_diagnostico' : 'aberta';
    if (confirm(`Deseja RETOMAR esta O.S para o status "${prevStatus}"?`)) {
       setServiceOrderStatus(osId, prevStatus as any);
    }
  };

  const activeOS = activeOSId ? serviceOrders.find(o => o.id === activeOSId) : undefined;

  const handleAttachWrapper = async (category: string, files: Array<{ path: string; name: string }>) => {
      if (!activeOSId) return;
      if (!window.lhgSystem?.docs) {
         alert('App desktop não detectado para manipulação de arquivos.');
         return;
      }
      for (const file of files) {
         const result = await window.lhgSystem.docs.save({ sourcePath: file.path, originalName: file.name });
         if (result.ok) {
            addOSStageAttachment(activeOSId, category as any, {
              filename: result.filename,
              label: file.name
            });
         }
      }
  };

  const handleRemoveAttachmentWrapper = async (id: string) => {
      if (!activeOSId) return;
      if (confirm('Remover anexo permanentemente?')) {
         // Aqui seria feita a deleção física
         removeOSStageAttachment(activeOSId, id);
      }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🛠️</span> Gestão de Ordens de Serviço (OS)
        </h2>
        <button
          onClick={() => handleAction('os', null)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold shadow-lg"
        >
          <span>➕</span> Nova OS
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por cliente ou Nº da OS..."
          value={internalSearch}
          onChange={(e) => setInternalSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 shadow-inner"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOS.map((os) => (
          <OSCard 
            key={os.id} 
            os={os} 
            onOpenFlow={(id: string) => setShowFlowId(id)}
          />
        ))}
        {filteredOS.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
            Nenhuma Ordem de Serviço encontrada.
          </div>
        )}
      </div>

      {/* Roteamento de Modais Independentes */}
      {activeModal === 'os' && (
         <OSCreationModal 
            os={activeOS}
            users={users}
            currentUser={currentUser}
            onClose={() => setActiveModal(null)}
            onSave={async (data, technicianId) => {
               if (!technicianId) {
                  alert('Selecione o técnico/responsável para usar o prefixo correto na OS.');
                  return;
               }
               if (activeOSId) {
                  updateServiceOrder(activeOSId, { ...data, userId: technicianId } as any);
               } else {
                  addServiceOrder(data as any, technicianId);
               }
               setActiveModal(null);
            }}
            onAttach={handleAttachWrapper}
            onRemoveAttachment={handleRemoveAttachmentWrapper}
         />
      )}

      {activeModal === 'diagnosis' && activeOS && (
         <DiagnosisModal 
            os={activeOS}
            onClose={() => setActiveModal(null)}
            onSave={async (diag) => {
               saveOSDiagnosis(activeOS.id, { ...diag, technicianNotes: '' });
               setServiceOrderStatus(activeOS.id, 'em_diagnostico');
               setActiveModal(null);
            }}
            onAttach={handleAttachWrapper}
            onRemoveAttachment={handleRemoveAttachmentWrapper}
         />
      )}

      {activeModal === 'budget' && activeOS && (
         <BudgetModal 
            os={activeOS}
            budgets={budgets} 
            products={products}
            onClose={() => setActiveModal(null)}
            onSave={async (budgetData) => {
               const existingBudget = budgets.find(b => b.osId === activeOS.id);
               if (existingBudget) {
                  updateBudget(existingBudget.id, budgetData);
               } else {
                  addBudget({ ...budgetData, osId: activeOS.id }, currentUser?.id || '');
               }
               setServiceOrderStatus(activeOS.id, 'aguardando_aprovacao');
               setActiveModal(null);
            }}
            onGeneratePDF={() => {
               const budgetToPrint = budgets.find(b => b.osId === activeOS.id);
               if (budgetToPrint) {
                  generateBudgetPDF(budgetToPrint, settings, 'print');
               } else {
                  alert('Salve o orçamento antes de gerar o PDF.');
               }
            }}
            onAttach={handleAttachWrapper}
            onRemoveAttachment={handleRemoveAttachmentWrapper}
         />
      )}

      {activeModal === 'contract' && activeOS && (
         <ContractModal 
            os={activeOS}
            onClose={() => setActiveModal(null)}
            onSave={async (contractData) => {
               generateOSContract(activeOS.id, contractData);
               setServiceOrderStatus(activeOS.id, 'aprovado');
               setActiveModal(null);
            }}
            onGeneratePDF={(overrides) => {
               const osToPrint = overrides
                 ? { ...activeOS, contract: { ...(activeOS.contract ?? {}), ...overrides } as any }
                 : activeOS;
               void generateContractPDF(osToPrint as any, settings, 'download');
            }}
            onAttach={handleAttachWrapper}
            onRemoveAttachment={handleRemoveAttachmentWrapper}
         />
      )}

      {activeModal === 'payment' && activeOS && (
         <PaymentModal 
            os={activeOS}
            onClose={() => setActiveModal(null)}
            onSave={async (paymentData) => {
               registerOSPayment(activeOS.id, paymentData);
               const oldTotal = activeOS.paymentSummary?.totalPaid || 0;
               const newTotal = oldTotal + paymentData.amount;
               if (activeOS.paymentSummary?.total && newTotal >= activeOS.paymentSummary.total) {
                  setServiceOrderStatus(activeOS.id, 'finalizado');
               }
               setActiveModal(null);
            }}
            onGenerateReceipt={() => {
               alert("Gerador de Recibo Isolado acionado!");
            }}
            onAttach={handleAttachWrapper}
            onRemoveAttachment={handleRemoveAttachmentWrapper}
         />
      )}

      {showFlowId && (
        <OSFlowModal 
          os={serviceOrders.find(o => o.id === showFlowId)!}
          onClose={() => setShowFlowId(null)}
          onAction={(modal, id) => {
            handleAction(modal, id);
            setShowFlowId(null);
          }}
          onCancel={handleCancelClick}
          onResume={handleResumeClick}
        />
      )}
    </div>
  );
}
