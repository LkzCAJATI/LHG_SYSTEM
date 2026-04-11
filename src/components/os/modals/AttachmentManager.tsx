import { useState } from 'react';
import { Download, Trash2, UploadCloud, FileArchive, CheckSquare, Square } from 'lucide-react';
import { OSAttachmentRef } from '../../../types';

interface Props {
  attachments: OSAttachmentRef[];
  category: 'os' | 'diagnostico' | 'orcamento' | 'contrato' | 'pagamento';
  onAdd: (files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  title?: string;
}

export function AttachmentManager({ attachments = [], category, onAdd, onRemove, title = "Anexos" }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selected.length === attachments.length) {
      setSelected([]);
    } else {
      setSelected(attachments.map(a => a.id));
    }
  };

  const handlePickAndUpload = async () => {
    if (!window.lhgSystem?.docs?.select) {
      alert("Disponível apenas no aplicativo desktop.");
      return;
    }
    setIsUploading(true);
    try {
      const files = await window.lhgSystem.docs.select();
      if (files && files.length > 0) {
        await onAdd(files);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSingle = async (attachment: OSAttachmentRef) => {
    if (!window.lhgSystem?.docs) {
      alert("Disponível apenas no aplicativo desktop.");
      return;
    }
    // Preferir abrir no sistema (mais simples). Se falhar, tentar baixar via read.
    const opened = await window.lhgSystem.docs.open(attachment.filename);
    if (opened?.ok) return;

    const res = await window.lhgSystem.docs.read(attachment.filename);
    if (!res?.ok || !res.data) {
      alert(res?.error || 'Falha ao ler anexo.');
      return;
    }
    const blob = new Blob([res.data as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.label || attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSelectedZip = async () => {
     if (selected.length === 0) return;
     if (!window.lhgSystem?.docs?.read) {
        alert("Disponível apenas no desktop.");
        return;
     }
     const zipParts: Array<{ name: string; data: Uint8Array }> = [];
     for (const id of selected) {
       const att = attachments.find(a => a.id === id);
       if (!att) continue;
       const res = await window.lhgSystem.docs.read(att.filename);
       if (res?.ok && res.data) {
         zipParts.push({ name: att.label || att.filename, data: res.data });
       }
     }
     if (zipParts.length === 0) {
       alert('Nenhum arquivo foi lido para compactar.');
       return;
     }
     const JSZip = (await import('jszip')).default;
     const zip = new JSZip();
     zipParts.forEach(p => zip.file(p.name, p.data));
     const blob = await zip.generateAsync({ type: 'blob' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${(title || 'anexos').replace(/\s+/g, '_').toLowerCase()}.zip`;
     document.body.appendChild(a);
     a.click();
     a.remove();
     URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-gray-300 uppercase flex items-center gap-2">
          📎 {title} ({attachments.length})
        </h4>
        <div className="flex gap-2">
           {selected.length > 0 && (
              <button 
                onClick={handleDownloadSelectedZip}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1"
              >
                <FileArchive className="w-3 h-3" /> Zip({selected.length})
              </button>
           )}
           <button 
             onClick={handlePickAndUpload}
             className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 font-bold shadow"
             disabled={isUploading}
           >
             <UploadCloud className="w-3 h-3" /> {isUploading ? "..." : "Adicionar"}
           </button>
        </div>
      </div>

      {attachments.length === 0 ? (
         <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-700 rounded-lg">
            Nenhum anexo nesta etapa.
         </div>
      ) : (
         <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {attachments.map(att => (
               <div key={att.id} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg border border-gray-700 hover:border-indigo-500/30 transition">
                 <div className="flex items-center gap-3 overflow-hidden">
                   <button onClick={() => handleToggleSelect(att.id)} className="text-gray-400 hover:text-indigo-400">
                     {selected.includes(att.id) ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                   </button>
                   <div className="truncate">
                      <p className="text-sm text-white truncate" title={att.label || att.filename}>{att.label || att.filename}</p>
                      <p className="text-[10px] text-gray-500">{new Date(att.createdAt).toLocaleString()}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <button onClick={() => handleDownloadSingle(att)} className="p-1.5 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded" title="Visualizar/Baixar original">
                       <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => onRemove(att.id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-700 hover:bg-gray-600 rounded" title="Remover">
                       <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}
