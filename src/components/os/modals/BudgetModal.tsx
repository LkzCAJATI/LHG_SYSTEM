import { useState, useMemo } from 'react';
import { ServiceOrder, Product, BudgetItem } from '../../../types';
import { AttachmentManager } from './AttachmentManager';
import { Search, Plus, X, Package } from 'lucide-react';

interface Props {
  os: ServiceOrder;
  budgets: any[];
  products: Product[];
  onSave: (budgetData: any) => Promise<void>;
  onClose: () => void;
  onAttach: (category: string, files: Array<{ path: string; name: string }>) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onGeneratePDF: () => void;
}

export function BudgetModal({ os, budgets, products, onSave, onClose, onAttach, onRemoveAttachment, onGeneratePDF }: Props) {
  const budget = budgets.find(b => b.osId === os.id);
  
  const [items, setItems] = useState<BudgetItem[]>(budget?.items || (os.diagnosis?.requiredParts ? [{ id: Math.random().toString(36).substr(2, 9), type: 'part', description: os.diagnosis.requiredParts, quantity: 1, unitPrice: 0, totalPrice: 0 }] : []));
  const [discount, setDiscount] = useState(budget?.discount || 0);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unitPrice: 0 });

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const total = subtotal - discount;

  const hasChanges = useMemo(() => {
     if (!budget) return true; // new budget
     if (discount !== budget.discount) return true;
     if (items.length !== budget.items.length) return true;
     // simple serialization check
     if (JSON.stringify(items) !== JSON.stringify(budget.items)) return true;
     return false;
  }, [budget, items, discount]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 5);

  const handleAddItem = (product?: Product) => {
    if (product) {
      const item: BudgetItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'part',
        description: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        imageUrl: product.image,
      };
      setItems(prev => [...prev, item]);
      setProductSearch('');
      setShowProductSearch(false);
      return;
    }
    if (!newItem.description || newItem.unitPrice <= 0) return;
    const item: BudgetItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'service',
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      totalPrice: newItem.quantity * newItem.unitPrice,
    };
    setItems(prev => [...prev, item]);
    setNewItem({ description: '', quantity: 1, unitPrice: 0 });
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave({
       customerName: os.customerName,
       customerCPF: os.customerCPF,
       customerPhone: os.customerPhone,
       items,
       subtotal,
       discount,
       total,
       status: budget?.status || 'pending',
    });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-4xl p-6 shadow-2xl mt-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">💰 Orçamento - {os.customerName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
              {/* Busca Estoque */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase flex items-center gap-2"><Package className="w-4 h-4"/> Adicionar do Estoque</h4>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductSearch(true);
                    }}
                    onFocus={() => setShowProductSearch(true)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500"
                    placeholder="Nome do produto ou código barras..."
                  />
                </div>
                {showProductSearch && productSearch && (
                  <div className="mt-2 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filteredProducts.map(product => (
                       <button
                          key={product.id}
                          onClick={() => handleAddItem(product)}
                          className="w-full text-left p-3 hover:bg-gray-700 border-b border-gray-700/50 flex justify-between items-center"
                       >
                          <span className="text-white text-sm">{product.name}</span>
                          <span className="font-bold text-purple-400">R$ {product.price.toFixed(2)}</span>
                       </button>
                    ))}
                    {filteredProducts.length === 0 && <div className="p-3 text-gray-400 text-sm">Produto não encontrado.</div>}
                  </div>
                )}
              </div>

              {/* Inserção Manual */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
                 <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase flex items-center gap-2">Criar Novo Item Sem Estoque</h4>
                 <div className="flex gap-2 items-end">
                   <div className="flex-[3]">
                     <label className="block text-xs uppercase text-gray-400 mb-1">Mão de Obra / Serviço</label>
                     <input value={newItem.description} onChange={e => setNewItem(prev => ({...prev, description: e.target.value}))} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white text-sm focus:border-purple-500" placeholder="Ex: Limpeza interna" />
                   </div>
                   <div className="flex-1">
                     <label className="block text-xs uppercase text-gray-400 mb-1">R$ Unit</label>
                     <input type="number" value={newItem.unitPrice || ''} onChange={e => setNewItem(prev => ({...prev, unitPrice: Number(e.target.value)}))} className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white text-sm focus:border-purple-500" />
                   </div>
                   <button onClick={() => handleAddItem()} className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg font-bold">
                     <Plus className="w-5 h-5"/>
                   </button>
                 </div>
              </div>

              <AttachmentManager 
                 attachments={os.attachmentsByCategory?.orcamento || []}
                 category="orcamento"
                 onAdd={async (files) => await onAttach('orcamento', files)}
                 onRemove={onRemoveAttachment}
                 title="Arquivos do Orçamento (Orçamento Fornecedor, etc)"
              />
           </div>

           <div>
              {/* Tabela de Itens */}
              <div className="border border-gray-700 rounded-xl overflow-hidden mb-4 bg-gray-900 flex flex-col h-[300px]">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-black border-b border-gray-700 sticky top-0">
                      <tr>
                         <th className="p-3 text-gray-300">Item</th>
                         <th className="p-3 text-right text-gray-300">Valor</th>
                         <th className="p-3 text-center w-10 text-gray-300">Ação</th>
                      </tr>
                    </thead>
                 </table>
                 <div className="overflow-y-auto flex-1">
                    <table className="w-full text-sm text-left">
                      <tbody>
                         {items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                               <td className="p-3 text-white font-medium">{item.description}</td>
                               <td className="p-3 text-right font-bold text-purple-400">R$ {item.totalPrice.toFixed(2)}</td>
                               <td className="p-3 text-center">
                                  <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-300 p-1 bg-red-900/30 rounded"><X className="w-4 h-4"/></button>
                               </td>
                            </tr>
                         ))}
                         {items.length === 0 && (
                            <tr><td colSpan={3} className="p-4 text-center text-gray-500">Nenhum item adicionado.</td></tr>
                         )}
                      </tbody>
                    </table>
                 </div>
              </div>

              {/* Finalização */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                 <div className="flex justify-between text-gray-400 text-sm mb-2">
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-800">
                    <label className="text-sm uppercase text-purple-400/80 font-bold">Desconto R$</label>
                    <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-24 bg-gray-800 border border-purple-900/50 rounded-lg p-1 text-white text-right font-bold text-sm focus:border-purple-500 outline-none" />
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-gray-300 font-bold uppercase text-sm">Valor Final</span>
                    <span className="text-3xl font-black text-purple-400 tracking-tight">R$ {total.toFixed(2)}</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-[1] py-3 bg-gray-700 hover:bg-gray-600 transition text-white rounded-xl font-bold">FECHAR</button>
          
          <button onClick={onGeneratePDF} disabled={!budget && items.length===0} className="flex-[1] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition text-white rounded-xl font-bold border border-indigo-500 shadow-lg" title="Gerar e Enviar PDF p/ Cliente">
            GERAR PDF
          </button>

          <button onClick={handleSave} disabled={!hasChanges || items.length === 0 || isSaving} className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-white rounded-xl font-extrabold shadow-lg shadow-purple-900/50">
            {isSaving ? "SALVANDO..." : (hasChanges ? "SALVAR CONDIÇÕES DO ORÇAMENTO" : "ORÇAMENTO SALVO")}
          </button>
        </div>
      </div>
    </div>
  );
}
