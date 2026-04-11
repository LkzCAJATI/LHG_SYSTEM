import { format } from 'date-fns';
import { ServiceOrder } from '../../types';
import { ChevronRight, Clock, Monitor, HardDrive, HelpCircle } from 'lucide-react';

interface Props {
  os: ServiceOrder;
  onOpenFlow: (osId: string) => void;
}

export function OSCard({ os, onOpenFlow }: Props) {
  const getStatusConfig = (status: ServiceOrder['status']) => {
    switch(status) {
       case 'aberta': return { label: 'Iniciado', color: 'bg-yellow-500', icon: <Clock className="w-3 h-3"/> };
       case 'em_diagnostico': return { label: 'Diagnóstico', color: 'bg-blue-500', icon: <Monitor className="w-3 h-3"/> };
       case 'aguardando_aprovacao': return { label: 'Aprovação', color: 'bg-orange-500', icon: <HelpCircle className="w-3 h-3"/> };
       case 'aprovado': return { label: 'Em Conserto', color: 'bg-indigo-500', icon: <HardDrive className="w-3 h-3"/> };
       case 'finalizado': return { label: 'Pronto', color: 'bg-emerald-500', icon: <ChevronRight className="w-3 h-3"/> };
       case 'canceled': return { label: 'Cancelado', color: 'bg-red-500', icon: <ChevronRight className="w-3 h-3"/> };
       default: return { label: status, color: 'bg-gray-500', icon: null };
    }
  };

  const getDeviceIcon = (type: string) => {
    switch(type) {
      case 'pc': return '🖥️';
      case 'notebook': return '💻';
      case 'console': return '🎮';
      case 'celular': return '📱';
      default: return '🛠️';
    }
  };

  const config = getStatusConfig(os.status);

  return (
    <div 
      onClick={() => onOpenFlow(os.id)}
      className="group relative bg-[#1a1c24] hover:bg-[#252833] rounded-3xl p-6 transition-all duration-300 cursor-pointer border border-gray-800/10 hover:border-purple-500/30 shadow-sm hover:shadow-2xl hover:shadow-purple-500/10 active:scale-95"
    >
      {/* OS Tag */}
      <div className="flex justify-between items-start mb-6">
        <span className="bg-gray-900/80 text-gray-400 font-black text-[10px] px-3 py-1.5 rounded-full tracking-widest border border-gray-800 transition-colors group-hover:border-purple-500/50 group-hover:text-purple-400">
           #{os.externalId}
        </span>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.color} bg-opacity-10 ${config.color.replace('bg-', 'text-')} font-black text-[10px] tracking-wide uppercase`}>
           {config.icon}
           {config.label}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-white font-black text-2xl tracking-tight leading-tight group-hover:text-purple-100 transition-colors truncate">
          {os.customerName}
        </h3>
        <div className="flex items-center gap-3 text-gray-500 text-xs font-bold pt-2">
           <span className="bg-gray-900 p-1.5 rounded-lg border border-gray-800">{getDeviceIcon(os.deviceType)}</span>
           <div className="flex flex-col">
              <span className="text-gray-300 uppercase tracking-wide truncate max-w-[150px]">{os.deviceBrandModel}</span>
              <span className="opacity-40">{format(new Date(os.createdAt), 'dd MMM, HH:mm')}</span>
           </div>
        </div>
      </div>

      {/* Action Indicator */}
      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
         <div className="bg-purple-600 p-2 rounded-xl text-white shadow-lg shadow-purple-900/40">
            <ChevronRight className="w-5 h-5" />
         </div>
      </div>
    </div>
  );
}
