import { useState } from 'react';
import { ServiceOrder } from '../../../types';
import { AttachmentManager } from './AttachmentManager';

interface Props {
  os: ServiceOrder;
  onSave: (diagnosis: { problemFound: string; testsPerformed: string; requiredParts: string }) => Promise<void>;
  onClose: () => void;
  onAttach: (category: string, files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
}

export function DiagnosisModal({ os, onSave, onClose, onAttach, onRemoveAttachment }: Props) {
  const [problem, setProblem] = useState(os.diagnosis?.problemFound || '');
  const [tests, setTests] = useState(os.diagnosis?.testsPerformed || '');
  const [parts, setParts] = useState(os.diagnosis?.requiredParts || '');
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = 
    problem !== (os.diagnosis?.problemFound || '') ||
    tests !== (os.diagnosis?.testsPerformed || '') ||
    parts !== (os.diagnosis?.requiredParts || '');

  const handleSave = async () => {
    if (!problem.trim()) {
      alert("O problema relatado é obrigatório.");
      return;
    }
    setIsSaving(true);
    await onSave({ problemFound: problem, testsPerformed: tests, requiredParts: parts });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">🔍 Diagnóstico Técnico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Problema Constatado pelo Técnico</label>
            <textarea 
              value={problem} 
              onChange={e => setProblem(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[100px]"
              placeholder="Descreva detalhadamente o problema encontrado..."
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Testes Realizados (Checklist Técnico)</label>
            <textarea 
              value={tests} 
              onChange={e => setTests(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[80px]"
              placeholder="Ex: Teste de memória, HD no CristalDiskInfo, Tensões da Fonte..."
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Peças Necessárias (Sugestão para Orçamento)</label>
            <textarea 
              value={parts} 
              onChange={e => setParts(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white min-h-[60px]"
              placeholder="O que vai precisar trocar ou cobrar?"
            />
          </div>
        </div>

        <AttachmentManager 
           attachments={os.attachmentsByCategory?.diagnostico || []}
           category="diagnostico"
           onAdd={async (files) => await onAttach('diagnostico', files)}
           onRemove={onRemoveAttachment}
           title="Arquivos do Diagnóstico (Fotos, Vídeos dos Testes)"
        />

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
           <button onClick={onClose} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold">FECHAR</button>
           <button 
             onClick={handleSave} 
             disabled={!hasChanges || isSaving}
             className="flex-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition text-white rounded-xl font-bold px-4"
           >
             {isSaving ? "Salvando..." : "Salvar Alterações do Diagnóstico"}
           </button>
        </div>
      </div>
    </div>
  );
}
