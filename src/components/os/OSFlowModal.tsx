import { ServiceOrder } from '../../types';

interface Props {
  os: ServiceOrder;
  onAction: (modal: 'os' | 'diagnosis' | 'budget' | 'contract' | 'payment', osId: string) => void;
  onCancel: (osId: string) => void;
  onResume: (osId: string) => void;
}

export function OSFlowModal({ os, onAction, onCancel, onResume, onClose }: Props & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
      <div className="bg-gray-800 border border-purple-500/30 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
        >
          <span className="text-2xl">&times;</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-purple-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
              #{os.externalId}
            </span>
          </div>
          <h2 className="text-3xl font-black text-white">{os.customerName}</h2>
          <p className="text-gray-400 mt-2 flex items-center gap-2">
             <span className="opacity-50">📱</span> {os.deviceType.toUpperCase()} — {os.deviceBrandModel}
          </p>
        </div>

        <div className="space-y-4 mb-8">
           <h4 className="text-xs font-black uppercase text-gray-500 tracking-[0.2em] mb-4">Etapas do Processo</h4>
           
           <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => onAction('os', os.id)} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${os.status === 'aberta' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/50'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700 group-hover:border-purple-500 group-hover:text-purple-400 transition-colors">1</span>
                  <span className="font-bold">FICHA TÉCNICA</span>
                </div>
                {os.status !== 'aberta' && <span className="text-emerald-500 font-bold text-sm">PRONTO</span>}
              </button>

              <button 
                onClick={() => onAction('diagnosis', os.id)} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${os.diagnosis ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/50'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700 group-hover:border-purple-500 group-hover:text-purple-400 transition-colors">2</span>
                  <span className="font-bold">DIAGNÓSTICO</span>
                </div>
                {os.diagnosis && <span className="text-emerald-500 font-bold text-sm">CONCLUÍDO</span>}
              </button>

              <button 
                onClick={() => os.diagnosis ? onAction('budget', os.id) : alert('Conclua o diagnóstico primeiro.')} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${!os.diagnosis ? 'opacity-40 grayscale cursor-not-allowed shadow-none' : (os.budgetId ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/50')}`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700 transition-colors">3</span>
                  <span className="font-bold">ORÇAMENTO</span>
                </div>
                {os.budgetId && <span className="text-emerald-500 font-bold text-sm">GERADO</span>}
              </button>

              <button 
                onClick={() => os.budgetId ? onAction('contract', os.id) : alert('Gere o orçamento primeiro.')} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${!os.budgetId ? 'opacity-40 grayscale cursor-not-allowed border-dashed' : (os.contract ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/50')}`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700 transition-colors">4</span>
                  <span className="font-bold">CONTRATO</span>
                </div>
                {os.contract && <span className="text-emerald-500 font-bold text-sm">ASSINADO</span>}
              </button>

              <button 
                onClick={() => os.contract ? onAction('payment', os.id) : alert('Aprove o contrato primeiro.')} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${!os.contract ? 'opacity-40 grayscale cursor-not-allowed border-dashed' : (os.status === 'finalizado' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-700/50')}`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700 transition-colors">5</span>
                  <span className="font-bold">PAGAMENTO</span>
                </div>
                {os.paymentSummary?.totalPaid ? <span className="text-emerald-500 font-black text-xs">R$ {os.paymentSummary.totalPaid.toFixed(2)}</span> : null}
              </button>
           </div>
        </div>

        <div className="flex gap-4 pt-6 border-t border-gray-700/50">
           {os.status === 'canceled' ? (
             <button 
               onClick={() => { onResume(os.id); onClose(); }} 
               className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-purple-900/20 active:scale-95"
             >
               RETOMAR O.S
             </button>
           ) : (
             <button 
               onClick={() => { onCancel(os.id); onClose(); }} 
               className="flex-1 py-4 bg-red-600/10 hover:bg-red-600 group rounded-2xl font-black text-sm transition-all border border-red-500/30 hover:border-red-500 text-red-500 hover:text-white active:scale-95"
             >
               CANCELAR
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
