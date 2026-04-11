import { useState } from 'react';
import { ServiceOrder } from '../../../types';
import { AttachmentManager } from './AttachmentManager';

interface Props {
  os: ServiceOrder;
  onSave: (paymentData: any) => Promise<void>;
  onClose: () => void;
  onAttach: (category: string, files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onGenerateReceipt: () => void;
}

export function PaymentModal({ os, onSave, onClose, onAttach, onRemoveAttachment, onGenerateReceipt }: Props) {
  const [type, setType] = useState<'entrada' | 'avista' | 'parcelado'>('avista');
  const [method, setMethod] = useState<'pix' | 'dinheiro' | 'debito' | 'credito'>('pix');
  const [amount, setAmount] = useState<string>('');
  
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Informe um valor válido.");
      return;
    }
    setIsSaving(true);
    await onSave({
      type,
      method,
      amount: Number(amount),
      notes: 'Recebimento via modal de pagamento'
    });
    setAmount('');
    setIsSaving(false);
    alert("Salvo com sucesso e integrado ao financeiro!");
  };

  const totalPago = os.paymentSummary?.totalPaid || 0;
  const targetTotal = (os.paymentSummary?.total || 0) > 0 ? os.paymentSummary?.total : null;
  const faltante = targetTotal ? targetTotal - totalPago : null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">💳 Recebimento / PDV</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        {targetTotal !== null && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 flex justify-between">
            <div className="text-gray-400">
               <div>Total OS: R$ {targetTotal.toFixed(2)}</div>
               <div>Já Pago: R$ {totalPago.toFixed(2)}</div>
            </div>
            <div className={`text-right text-lg font-bold ${faltante && faltante > 0 ? 'text-red-400' : 'text-purple-400'}`}>
               Falta Aprovar: R$ {faltante ? faltante.toFixed(2) : '0.00'}
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs uppercase text-gray-400 mb-1">Tipo de Lançamento</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                   <option value="avista">Pagamento Integral (À Vista)</option>
                   <option value="entrada">Entrada / Sinal</option>
                   <option value="parcelado">Pagamento de Parcela</option>
                </select>
             </div>
             <div>
                <label className="block text-xs uppercase text-gray-400 mb-1">Forma de Pagamento</label>
                <select value={method} onChange={e => setMethod(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                   <option value="pix">PIX</option>
                   <option value="dinheiro">Dinheiro</option>
                   <option value="credito">C. Crédito</option>
                   <option value="debito">C. Débito</option>
                </select>
             </div>
          </div>

          <div className="bg-gray-900 border border-purple-900/40 rounded-xl p-6 text-center">
             <p className="text-purple-400 text-sm font-bold mb-2 uppercase tracking-wide">Valor a Receber (R$)</p>
             <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="bg-transparent border-b-2 border-purple-600 outline-none text-4xl font-black text-white w-48 text-center"
                placeholder="0.00"
             />
          </div>
        </div>

        <AttachmentManager 
           attachments={os.attachmentsByCategory?.pagamento || []}
           category="pagamento"
           onAdd={async (files) => await onAttach('pagamento', files)}
           onRemove={onRemoveAttachment}
           title="Comprovantes (Recibos, Prints PIX)"
        />

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
           <button onClick={onClose} className="flex-[1] py-3 bg-gray-700 hover:bg-gray-600 transition text-white rounded-xl font-bold">FECHAR</button>
           <button onClick={onGenerateReceipt} className="flex-[1] py-3 bg-indigo-600 hover:bg-indigo-500 transition text-white rounded-xl font-bold shadow-lg">
             GERAR RECIBO
           </button>
           <button 
             onClick={handleSave} 
             disabled={isSaving || !amount}
             className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-white rounded-xl font-extrabold shadow-lg shadow-purple-900/50"
           >
             {isSaving ? "PROCESSANDO..." : "CONFIRMAR NO CAIXA"}
           </button>
        </div>
      </div>
    </div>
  );
}
