import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import { Budget, Sale, ServiceOrder } from '../types';
import { Download, Edit, FileText, Paperclip, Printer, Search } from 'lucide-react';
import { generateBudgetPDF, generateOSPDF, generatePDVCouponPDF, generateReceiptPDF } from '../utils/pdfGenerator';

type DocKind = 'os' | 'budget' | 'sale';
type ClientDoc = {
  kind: DocKind;
  id: string;
  customerName?: string;
  customerCPF?: string;
  customerPhone?: string;
  createdAt: Date;
  title: string;
  subtitle?: string;
  attachments: string[];
  raw: ServiceOrder | Budget | Sale;
};

const safeLower = (value: string | undefined | null) => (value || '').toLowerCase();

export default function DocumentsManager() {
  const { serviceOrders, budgets, sales, updateServiceOrder, updateBudget, updateSale } = useStore();
  const { settings } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'os' | 'budget' | 'sale'>('all');
  const [editingDoc, setEditingDoc] = useState<ClientDoc | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');

  const docs: ClientDoc[] = useMemo(() => {
    const osDocs: ClientDoc[] = serviceOrders.map((os) => ({
      kind: 'os',
      id: os.id,
      customerName: os.customerName,
      customerCPF: os.customerCPF,
      customerPhone: os.customerPhone,
      createdAt: os.createdAt,
      title: `OS #${os.externalId || os.id.slice(0, 8).toUpperCase()}`,
      subtitle: `${os.deviceType.toUpperCase()} - ${os.deviceBrandModel}`,
      attachments: os.attachments || [],
      raw: os
    }));
    const budgetDocs: ClientDoc[] = budgets.map((b) => ({
      kind: 'budget',
      id: b.id,
      customerName: b.customerName,
      customerCPF: b.customerCPF,
      customerPhone: b.customerPhone,
      createdAt: b.createdAt,
      title: `Orçamento #${(b.externalId || b.id.slice(0, 8)).toUpperCase()}`,
      subtitle: `${b.items.length} item(ns) • Total R$ ${b.total.toFixed(2)}`,
      attachments: b.attachments || [],
      raw: b
    }));
    const saleDocs: ClientDoc[] = sales.map((s) => ({
      kind: 'sale',
      id: s.id,
      customerName: s.customerName,
      createdAt: s.createdAt,
      title: `Venda #${s.id.slice(0, 8).toUpperCase()}`,
      subtitle: `Total R$ ${s.total.toFixed(2)} • ${s.paymentMethod.toUpperCase()}`,
      attachments: s.attachments || [],
      raw: s
    }));
    return [...osDocs, ...budgetDocs, ...saleDocs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [serviceOrders, budgets, sales]);

  const filtered = useMemo(() => {
    const q = safeLower(query).trim();
    const byType = docs.filter((d) => docFilter === 'all' || d.kind === docFilter);
    if (!q) return byType;
    return byType.filter((d) => {
      const hay = [d.title, d.subtitle, d.customerName, d.customerCPF, d.customerPhone].filter(Boolean).join(' ');
      return safeLower(hay).includes(q);
    });
  }, [docs, query, docFilter]);

  const handleAttach = async (doc: ClientDoc) => {
    if (!window.lhgSystem?.docs) return;
    const files = await window.lhgSystem.docs.select();
    if (!files || files.length === 0) return;
    const file = files[0];
    const result = await window.lhgSystem.docs.save({ sourcePath: file.path, originalName: file.name });
    if (!result.ok) {
      alert(result.error || 'Falha ao salvar anexo.');
      return;
    }
    const filename = result.filename;
    if (doc.kind === 'os') {
      const os = doc.raw as ServiceOrder;
      updateServiceOrder(os.id, { attachments: [...(os.attachments || []), filename] });
    } else if (doc.kind === 'budget') {
      const b = doc.raw as Budget;
      updateBudget(b.id, { attachments: [...(b.attachments || []), filename] });
    } else {
      const s = doc.raw as Sale;
      updateSale(s.id, { attachments: [...(s.attachments || []), filename] });
    }
  };

  const handleDownload = (doc: ClientDoc) => {
    if (doc.kind === 'os') return generateOSPDF(doc.raw as ServiceOrder, settings, 'download');
    if (doc.kind === 'budget') return generateBudgetPDF(doc.raw as Budget, settings, 'download');
    const sale = doc.raw as Sale;
    if (sale.source === 'budget') return generateReceiptPDF(sale, settings, 'download');
    return generatePDVCouponPDF(sale, settings, 'download');
  };

  const handlePrint = (doc: ClientDoc) => {
    if (doc.kind === 'os') return generateOSPDF(doc.raw as ServiceOrder, settings, 'print');
    if (doc.kind === 'budget') return generateBudgetPDF(doc.raw as Budget, settings, 'print');
    const sale = doc.raw as Sale;
    if (sale.source === 'budget') return generateReceiptPDF(sale, settings, 'print');
    return generatePDVCouponPDF(sale, settings, 'print');
  };

  const openEdit = (doc: ClientDoc) => {
    setEditingDoc(doc);
    setEditCustomerName(doc.customerName || '');
  };

  const saveEdit = () => {
    if (!editingDoc) return;
    if (editingDoc.kind === 'os') updateServiceOrder(editingDoc.id, { customerName: editCustomerName });
    if (editingDoc.kind === 'budget') updateBudget(editingDoc.id, { customerName: editCustomerName });
    if (editingDoc.kind === 'sale') updateSale(editingDoc.id, { customerName: editCustomerName });
    setEditingDoc(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Documentos</h1>
        <p className="text-gray-500">Área exclusiva para documentos: editar, imprimir e anexar</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setDocFilter('os')} className={`px-3 py-1.5 rounded-lg text-sm ${docFilter === 'os' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700'}`}>OS</button>
        <button onClick={() => setDocFilter('budget')} className={`px-3 py-1.5 rounded-lg text-sm ${docFilter === 'budget' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700'}`}>Orçamentos</button>
        <button onClick={() => setDocFilter('sale')} className={`px-3 py-1.5 rounded-lg text-sm ${docFilter === 'sale' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700'}`}>Vendas/Recibos</button>
        <button onClick={() => setDocFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm ${docFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700'}`}>Tudo</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border rounded-xl"
          placeholder="Buscar documento por cliente, número, tipo..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <div key={`${d.kind}:${d.id}`} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleString()}</p>
                <h3 className="font-bold text-lg text-gray-800 truncate">{d.title}</h3>
                <p className="text-sm text-gray-500 truncate">{d.customerName || 'Cliente não informado'}</p>
                {d.subtitle && <p className="text-xs text-gray-400 truncate">{d.subtitle}</p>}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openEdit(d)} className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"><Edit className="w-4 h-4" />Editar</button>
              <button onClick={() => handleAttach(d)} className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"><Paperclip className="w-4 h-4" />Anexar ({d.attachments.length})</button>
              <button onClick={() => handleDownload(d)} className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"><Download className="w-4 h-4" />PDF</button>
              <button onClick={() => handlePrint(d)} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2 text-sm"><Printer className="w-4 h-4" />Imprimir</button>
            </div>
          </div>
        ))}
      </div>

      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Editar documento</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
            <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingDoc(null)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={saveEdit} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
