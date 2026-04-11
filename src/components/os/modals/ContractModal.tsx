import { useState, useMemo } from 'react';
import { ServiceOrder } from '../../../types';
import { AttachmentManager } from './AttachmentManager';

interface Props {
  os: ServiceOrder;
  onSave: (contractData: any) => Promise<void>;
  onClose: () => void;
  onAttach: (category: string, files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onGeneratePDF: (data?: any) => void;
}

export function ContractModal({ os, onSave, onClose, onAttach, onRemoveAttachment, onGeneratePDF }: Props) {
  const [type, setType] = useState<'reparo' | 'venda'>('reparo');
  const [paymentTerms, setPaymentTerms] = useState(os.contract?.paymentTerms || 'Conforme combinado');
  const [warrantyTerms, setWarrantyTerms] = useState(os.contract?.warrantyTerms || '90 dias');
  const [inadimplencia, setInadimplencia] = useState(os.contract?.defaultTerms?.inadimplencia || '2%');
  const [isSaving, setIsSaving] = useState(false);

  // Consider contract changed logic
  const hasChanges = useMemo(() => {
     if (!os.contract) return true;
     if (paymentTerms !== os.contract.paymentTerms) return true;
     if (warrantyTerms !== os.contract.warrantyTerms) return true;
     if (inadimplencia !== os.contract.defaultTerms?.inadimplencia) return true;
     return false;
  }, [os.contract, paymentTerms, warrantyTerms, inadimplencia]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
      type,
      objectDescription: os.deviceBrandModel,
      totalValue: os.paymentSummary?.total || 0,
      paymentTerms,
      warrantyTerms,
      defaultTerms: { inadimplencia, quitacao: 'Total', foro: 'Cajati' }
    });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">📑 Contrato Jurídico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="block text-xs uppercase text-gray-400 mb-1">Tipo de Contrato</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white">
                   <option value="reparo">Prestação de Serviços (Reparo)</option>
                   <option value="venda">Compra e Venda</option>
                </select>
             </div>
             <div className="flex-1">
                <label className="block text-xs uppercase text-gray-400 mb-1">Multa de Inadimplência</label>
                <input value={inadimplencia} onChange={e => setInadimplencia(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white" />
             </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Cláusula de Pagamento</label>
            <textarea 
              value={paymentTerms} 
              onChange={e => setPaymentTerms(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[60px]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Termos de Garantia (Cláusula Completa)</label>
            <textarea 
              value={warrantyTerms} 
              onChange={e => setWarrantyTerms(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[100px]"
            />
          </div>
        </div>

        <AttachmentManager 
           attachments={os.attachmentsByCategory?.contrato || []}
           category="contrato"
           onAdd={async (files) => await onAttach('contrato', files)}
           onRemove={onRemoveAttachment}
           title="Contratos Assinados (PDF, Scanner, Foto)"
        />

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
           <button onClick={onClose} className="flex-[1] py-3 bg-gray-700 hover:bg-gray-600 transition text-white rounded-xl font-bold">FECHAR</button>
            <button 
              onClick={() => onGeneratePDF({
                type,
                paymentTerms,
                warrantyTerms,
                defaultTerms: { inadimplencia, quitacao: 'Total', foro: 'Cajati' },
                objectDescription: os.deviceBrandModel,
                totalValue: os.paymentSummary?.total || 0
              })} 
              className="flex-[1] py-3 bg-indigo-600 hover:bg-indigo-500 transition text-white rounded-xl font-bold border border-indigo-500 shadow-lg flex items-center justify-center gap-2"
              title="Baixar PDF do contrato com as cláusulas atuais da tela"
            >
              <span>📥</span> BAIXAR PDF
            </button>
           <button 
             onClick={handleSave} 
             disabled={!hasChanges || isSaving}
             className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-white rounded-xl font-extrabold shadow-lg shadow-purple-900/50"
           >
             {isSaving ? "SALVANDO..." : (hasChanges ? "SALVAR CLÁUSULAS" : "CONTRATO SALVO")}
           </button>
        </div>
      </div>
    </div>
  );
}
