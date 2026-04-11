import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import { Budget, BudgetItem, PaymentEntry, Sale, ServiceOrder } from '../types';
import {
  Download,
  Edit,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Search
} from 'lucide-react';
import {
  generateBudgetPDF,
  generateContractPDF,
  generateOSPDF,
  generatePDVCouponPDF,
  generateReceiptPDF
} from '../utils/pdfGenerator';

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

function safeLower(value: string | undefined | null) {
  return (value || '').toLowerCase();
}

export default function ClientDocuments() {
  const {
    users,
    currentUser,
    serviceOrders,
    budgets,
    sales,
    addServiceOrder,
    addBudget,
    updateServiceOrder,
    updateBudget,
    updateSale,
    convertOSToBudget,
    saveOSDiagnosis,
    approveBudgetForOS,
    generateOSContract,
    registerOSPayment,
    addOSAttachment,
    setCurrentPage
  } = useStore();
  const { settings } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'os' | 'budget' | 'sale'>('os');
  const [diagnosisOS, setDiagnosisOS] = useState<ServiceOrder | null>(null);
  const [paymentOS, setPaymentOS] = useState<ServiceOrder | null>(null);
  const [attachOS, setAttachOS] = useState<ServiceOrder | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    type: 'entrada' as PaymentEntry['type'],
    method: 'pix' as PaymentEntry['method'],
    amount: 0,
    installmentNumber: 1,
    installmentsTotal: 1,
    notes: ''
  });
  const [diagnosisForm, setDiagnosisForm] = useState({
    problemFound: '',
    testsPerformed: '',
    requiredParts: '',
    technicianNotes: ''
  });

  const [editingDoc, setEditingDoc] = useState<ClientDoc | null>(null);
  const [creatingKind, setCreatingKind] = useState<null | 'os' | 'budget'>(null);
  const [generateBudgetAfterOS, setGenerateBudgetAfterOS] = useState(true);
  const [editingContractSale, setEditingContractSale] = useState<Sale | null>(null);
  const [contractForm, setContractForm] = useState({
    client: '',
    cpf: '',
    objeto: '',
    payment: '',
    total: '',
  });

  const [osForm, setOsForm] = useState({
    userId: '',
    customerName: '',
    customerCPF: '',
    customerPhone: '',
    isOver18: false,
    deviceType: 'pc' as ServiceOrder['deviceType'],
    deviceBrandModel: '',
    serialNumber: '',
    physicalState: '',
    customerComplaint: '',
    selectedServices: [] as string[],
    otherService: '',
    notes: '',
    status: 'open' as ServiceOrder['status'],
  });

  const [budgetForm, setBudgetForm] = useState({
    userId: '',
    customerName: '',
    customerCPF: '',
    customerPhone: '',
    discount: 0,
    notes: '',
  });

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [newBudgetItem, setNewBudgetItem] = useState({
    type: 'part' as BudgetItem['type'],
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountType: 'value' as NonNullable<BudgetItem['discountType']>,
    discountValue: 0,
  });

  const [saleForm, setSaleForm] = useState({
    customerName: '',
  });

  const calcItemTotal = (item: Pick<BudgetItem, 'quantity' | 'unitPrice' | 'discountType' | 'discountValue'>) => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unitPrice) || 0;
    const base = qty * unit;
    const discountType = item.discountType || 'value';
    const discountValue = Math.max(0, Number(item.discountValue) || 0);
    const discount = discountType === 'percent'
      ? Math.min(base, base * Math.min(100, discountValue) / 100)
      : Math.min(base, discountValue);
    return Math.max(0, base - discount);
  };

  const calcBudgetSubtotal = (items: BudgetItem[]) => items.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);

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
      raw: os,
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
      raw: b,
    }));

    const saleDocs: ClientDoc[] = sales.map((s) => ({
      kind: 'sale',
      id: s.id,
      customerName: s.customerName,
      customerCPF: undefined,
      customerPhone: undefined,
      createdAt: s.createdAt,
      title: `Venda #${s.id.slice(0, 8).toUpperCase()}`,
      subtitle: `Total R$ ${s.total.toFixed(2)} • ${s.paymentMethod.toUpperCase()}`,
      attachments: s.attachments || [],
      raw: s,
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
      const hay = [
        d.title,
        d.subtitle,
        d.customerName,
        d.customerCPF,
        d.customerPhone,
      ]
        .filter(Boolean)
        .join(' ');
      return safeLower(hay).includes(q);
    });
  }, [docs, query, docFilter]);

  const handleAttach = async (doc: ClientDoc) => {
    if (!window.lhgSystem?.docs) {
      alert('Anexos indisponíveis neste modo.');
      return;
    }

    const file = await window.lhgSystem.docs.select();
    if (!file) return;

    const result = await window.lhgSystem.docs.save({
      sourcePath: file.path,
      originalName: file.name,
    });

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

    alert('Documento anexado com sucesso!');
  };

  const handleSubmitDiagnosis = () => {
    if (!diagnosisOS) return;
    if (!diagnosisForm.problemFound.trim()) {
      alert('Informe o problema identificado.');
      return;
    }
    saveOSDiagnosis(diagnosisOS.id, diagnosisForm);
    setDiagnosisOS(null);
    setDiagnosisForm({
      problemFound: '',
      testsPerformed: '',
      requiredParts: '',
      technicianNotes: ''
    });
  };

  const handleRegisterPayment = () => {
    if (!paymentOS) return;
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      alert('Informe um valor válido.');
      return;
    }
    const receipt = registerOSPayment(paymentOS.id, paymentForm);
    if (receipt) {
      alert(`Pagamento registrado. Recibo: ${receipt.receiptNumber}`);
      setPaymentOS(null);
      setPaymentForm({
        type: 'entrada',
        method: 'pix',
        amount: 0,
        installmentNumber: 1,
        installmentsTotal: 1,
        notes: ''
      });
    }
  };

  const handleCategorizedAttach = async (category: 'os_signed' | 'budget_signed' | 'contract_signed' | 'receipt_signed' | 'photo' | 'video' | 'other') => {
    if (!attachOS || !window.lhgSystem?.docs) return;
    const file = await window.lhgSystem.docs.select();
    if (!file) return;
    const result = await window.lhgSystem.docs.save({
      sourcePath: file.path,
      originalName: file.name
    });
    if (!result.ok) {
      alert(result.error || 'Falha ao anexar.');
      return;
    }
    addOSAttachment(attachOS.id, {
      filename: result.filename,
      category,
      label: file.name
    });
    alert('Anexo adicionado na categoria selecionada.');
  };

  const handleOpenFirstAttachment = async (doc: ClientDoc) => {
    const first = doc.attachments?.[0];
    if (!first) return;
    await window.lhgSystem?.docs?.open(first);
  };

  const handleDownload = (doc: ClientDoc) => {
    if (doc.kind === 'os') return generateOSPDF(doc.raw as ServiceOrder, settings, 'download');
    if (doc.kind === 'budget') return generateBudgetPDF(doc.raw as Budget, settings, 'download');
    // venda (recibo/cupom)
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

  const getSaleReceiptLabel = (sale: Sale) => (sale.source === 'budget' ? 'Recibo' : 'Cupom');

  const openContractEditor = (sale: Sale) => {
    const paymentLabel = sale.paymentMethod === 'installment'
      ? `Parcelado em ${sale.installments?.length || 1}x`
      : sale.paymentMethod.toUpperCase();
    setContractForm({
      client: sale.customerName || '',
      cpf: '',
      objeto: sale.items.map(i => i.name).join(', '),
      payment: paymentLabel,
      total: `R$ ${sale.total.toFixed(2)}`
    });
    setEditingContractSale(sale);
  };

  const handleGenerateContract = () => {
    if (!editingContractSale) return;
    const saleAsServiceOrder = {
      id: editingContractSale.id,
      externalId: editingContractSale.id.slice(0, 8).toUpperCase(),
      customerName: contractForm.client || editingContractSale.customerName || '',
      customerCPF: contractForm.cpf || undefined,
      customerPhone: undefined,
      createdAt: editingContractSale.createdAt,
      deviceType: 'outro',
      deviceBrandModel: contractForm.objeto || editingContractSale.items.map(i => i.name).join(', '),
      serialNumber: '',
      physicalState: '',
      customerComplaint: '',
      selectedServices: [],
      status: 'open',
      contract: {
        type: 'venda',
        objectDescription: contractForm.objeto || editingContractSale.items.map(i => i.name).join(', '),
        totalValue: editingContractSale.total,
        paymentTerms: contractForm.payment || 'A combinar',
        warrantyTerms: '',
        defaultTerms: {
          inadimplencia: '',
          quitacao: '',
          foro: ''
        }
      },
      paymentSummary: undefined
    } as any;

    generateContractPDF(saleAsServiceOrder, settings, 'download', {
      CLIENTE: contractForm.client || '____________________',
      CPF: contractForm.cpf || '____________________',
      OBJETO: contractForm.objeto || '____________________',
      FORMA_PAGAMENTO: contractForm.payment || '____________________',
      VALOR_TOTAL: contractForm.total || `R$ ${editingContractSale.total.toFixed(2)}`,
      DATA: format(new Date(), 'dd/MM/yyyy')
    });
    setEditingContractSale(null);
  };

  const availableServices = [
    'Diagnóstico para identificar o problema',
    'Formatação',
    'Limpeza completa',
    'Troca de pasta térmica',
    'Atualização de drivers',
    'Outros'
  ];

  const openEdit = (doc: ClientDoc) => {
    setEditingDoc(doc);
    if (doc.kind === 'os') {
      const os = doc.raw as ServiceOrder;
      setOsForm({
        userId: os.userId || currentUser?.id || '',
        customerName: os.customerName || '',
        customerCPF: os.customerCPF || '',
        customerPhone: os.customerPhone || '',
        isOver18: Boolean(os.isOver18),
        deviceType: os.deviceType,
        deviceBrandModel: os.deviceBrandModel || '',
        serialNumber: os.serialNumber || '',
        physicalState: os.physicalState || '',
        customerComplaint: os.customerComplaint || '',
        selectedServices: (os.selectedServices || []).filter(s => availableServices.includes(s)),
        otherService: (os.selectedServices || []).find(s => !availableServices.includes(s)) || '',
        notes: os.notes || '',
        status: os.status,
      });
    } else if (doc.kind === 'budget') {
      const b = doc.raw as Budget;
      setBudgetForm({
        userId: b.userId || currentUser?.id || '',
        customerName: b.customerName || '',
        customerCPF: b.customerCPF || '',
        customerPhone: b.customerPhone || '',
        discount: b.discount || 0,
        notes: b.notes || '',
      });
      setBudgetItems(
        (b.items || []).map(it => ({
          ...it,
          discountType: it.discountType || 'value',
          discountValue: it.discountValue || 0,
          totalPrice: Number.isFinite(it.totalPrice) ? it.totalPrice : calcItemTotal(it),
        }))
      );
      setNewBudgetItem({
        type: 'part',
        description: '',
        quantity: 1,
        unitPrice: 0,
        discountType: 'value',
        discountValue: 0,
      });
    } else {
      const s = doc.raw as Sale;
      setSaleForm({
        customerName: s.customerName || '',
      });
    }
  };

  const openCreateOS = () => {
    setCreatingKind('os');
    setEditingDoc(null);
    setOsForm({
      userId: currentUser?.id || '',
      customerName: '',
      customerCPF: '',
      customerPhone: '',
      isOver18: false,
      deviceType: 'pc',
      deviceBrandModel: '',
      serialNumber: '',
      physicalState: '',
      customerComplaint: '',
      selectedServices: [],
      otherService: '',
      notes: '',
      status: 'open',
    });
    setGenerateBudgetAfterOS(true);
  };

  const openCreateBudget = () => {
    setCreatingKind('budget');
    setEditingDoc(null);
    setBudgetForm({
      userId: currentUser?.id || '',
      customerName: '',
      customerCPF: '',
      customerPhone: '',
      discount: 0,
      notes: '',
    });
    setBudgetItems([]);
    setNewBudgetItem({
      type: 'part',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountType: 'value',
      discountValue: 0,
    });
  };

  const saveCreate = () => {
    if (!creatingKind) return;
    if (creatingKind === 'os') {
      if (!osForm.customerName.trim() || !osForm.deviceBrandModel.trim()) {
        alert('Preencha o nome do cliente e o modelo do aparelho.');
        return;
      }
      const createdOSId = addServiceOrder({
        customerName: osForm.customerName.trim(),
        customerCPF: osForm.customerCPF || undefined,
        customerPhone: osForm.customerPhone || undefined,
        isOver18: osForm.isOver18,
        deviceType: osForm.deviceType,
        deviceBrandModel: osForm.deviceBrandModel.trim(),
        serialNumber: osForm.serialNumber,
        physicalState: osForm.physicalState,
        customerComplaint: osForm.customerComplaint,
        selectedServices: osForm.otherService 
          ? [...osForm.selectedServices.filter(s => s !== 'Outros'), osForm.otherService]
          : osForm.selectedServices.filter(s => s !== 'Outros'),
        status: osForm.status,
        notes: osForm.notes || undefined,
      }, osForm.userId || currentUser?.id);
      if (createdOSId && generateBudgetAfterOS) {
        convertOSToBudget(createdOSId);
      }
      setCreatingKind(null);
      return;
    }

    // budget
    if (!budgetForm.customerName.trim() || !budgetForm.customerCPF.trim() || !budgetForm.customerPhone.trim()) {
      alert('Preencha os dados do cliente: nome, CPF e telefone.');
      return;
    }
    if (budgetItems.length === 0) {
      alert('Adicione pelo menos 1 item no orçamento.');
      return;
    }
    const normalizedItems = budgetItems.map(it => ({
      ...it,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      discountType: it.discountType || 'value',
      discountValue: Number(it.discountValue) || 0,
      totalPrice: calcItemTotal(it),
    }));
    const subtotal = calcBudgetSubtotal(normalizedItems);
    const discount = Math.max(0, Number(budgetForm.discount) || 0);
    addBudget({
      customerName: budgetForm.customerName.trim(),
      customerCPF: budgetForm.customerCPF.trim(),
      customerPhone: budgetForm.customerPhone.trim(),
      items: normalizedItems,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      notes: budgetForm.notes || undefined,
      status: 'pending',
    } as any, budgetForm.userId || currentUser?.id);
    setCreatingKind(null);
  };

  const saveEdit = () => {
    if (!editingDoc) return;
    if (editingDoc.kind === 'os') {
      const os = editingDoc.raw as ServiceOrder;
      const employee = users.find(u => u.id === osForm.userId);
      updateServiceOrder(os.id, {
        customerName: osForm.customerName,
        customerCPF: osForm.customerCPF || undefined,
        customerPhone: osForm.customerPhone || undefined,
        isOver18: osForm.isOver18,
        deviceType: osForm.deviceType,
        deviceBrandModel: osForm.deviceBrandModel,
        serialNumber: osForm.serialNumber,
        physicalState: osForm.physicalState,
        customerComplaint: osForm.customerComplaint,
        selectedServices: osForm.otherService 
          ? [...osForm.selectedServices.filter(s => s !== 'Outros'), osForm.otherService]
          : osForm.selectedServices.filter(s => s !== 'Outros'),
        notes: osForm.notes || undefined,
        status: osForm.status,
        userId: employee?.id || os.userId,
        userName: employee?.name || os.userName,
      });
    } else if (editingDoc.kind === 'budget') {
      const b = editingDoc.raw as Budget;
      const employee = users.find(u => u.id === budgetForm.userId);
      const normalizedItems = budgetItems.map(it => ({
        ...it,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discountType: it.discountType || 'value',
        discountValue: Number(it.discountValue) || 0,
        totalPrice: calcItemTotal(it),
      }));
      const subtotal = calcBudgetSubtotal(normalizedItems);
      const discount = Math.max(0, Number(budgetForm.discount) || 0);
      updateBudget(b.id, {
        customerName: budgetForm.customerName,
        customerCPF: budgetForm.customerCPF || undefined,
        customerPhone: budgetForm.customerPhone || undefined,
        items: normalizedItems,
        subtotal,
        discount,
        notes: budgetForm.notes || undefined,
        total: Math.max(0, subtotal - discount),
        userId: employee?.id || b.userId,
        userName: employee?.name || b.userName,
      });
    } else {
      const s = editingDoc.raw as Sale;
      updateSale(s.id, {
        customerName: saleForm.customerName || undefined,
      });
    }
    setEditingDoc(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Documentos</h1>
          <p className="text-gray-500">Fluxo por cliente: OS, orçamento, contrato, pagamentos e anexos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage('users')}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            title="Gerenciar funcionários e criar novos"
          >
            <Plus className="w-4 h-4" />
            Funcionários
          </button>
          <button
            onClick={openCreateOS}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black flex items-center gap-2"
            title="Criar nova OS"
          >
            <Plus className="w-4 h-4" />
            Nova OS
          </button>
          <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm">
            Orçamento é criado a partir da OS
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setDocFilter('os')} className={`px-3 py-1.5 rounded-lg text-sm ${docFilter === 'os' ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700'}`}>Ordens de Serviço</button>
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
          placeholder="Buscar por cliente, CPF/telefone, número, tipo..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <div key={`${d.kind}:${d.id}`} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleString()}
                </p>
                <h3 className="font-bold text-lg text-gray-800 truncate">{d.title}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {d.customerName || 'Cliente não informado'}
                </p>
                {d.subtitle && (
                  <p className="text-xs text-gray-400 truncate">{d.subtitle}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => openEdit(d)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            </div>

            {d.kind === 'os' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setDiagnosisOS(d.raw as ServiceOrder)}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium"
                >
                  Diagnóstico
                </button>
                <button
                  onClick={() => convertOSToBudget((d.raw as ServiceOrder).id)}
                  className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium"
                >
                  Gerar Orçamento
                </button>
                <button
                  onClick={() => {
                    const os = d.raw as ServiceOrder;
                    const value = Number(prompt('Valor total do contrato', '0') || '0');
                    if (value <= 0) return;
                      generateOSContract(os.id, {
                        type: value > 0 ? 'parcelado' : 'avista',
                        objectDescription: (os.selectedServices || []).join(', ') || os.deviceBrandModel,
                        totalValue: value,
                        paymentTerms: 'Conforme acordado com cliente',
                        warrantyTerms: 'Garantia legal e condições da assistência',
                        defaultTerms: {
                          inadimplencia: 'O não pagamento de 2 parcelas consecutivas poderá resultar na cobrança administrativa ou judicial do débito.',
                          quitacao: 'Após o pagamento total do valor acordado, será emitido recibo de quitação total, encerrando-se as obrigações entre as partes.',
                          foro: 'Fica eleito o foro da comarca de Cajati/SP para dirimir quaisquer dúvidas oriundas deste contrato.'
                        }
                      });
                    }}
                    className="px-3 py-2 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 text-sm font-medium"
                  >
                    Gerar Contrato
                  </button>
                  {budgets.find(b => b.osId === (d.raw as ServiceOrder).id) && (
                    <button
                      onClick={() => {
                        const b = budgets.find(b => b.osId === (d.raw as ServiceOrder).id);
                        if (b) openEdit({ kind: 'budget', id: b.id, createdAt: b.createdAt, title: '', attachments: [], raw: b });
                      }}
                      className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm font-medium"
                    >
                      Editar Orçamento
                    </button>
                  )}
                  <button
                    onClick={() => setPaymentOS(d.raw as ServiceOrder)}
                    className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium"
                  >
                    Registrar Pagto
                  </button>
                <button
                  onClick={() => setAttachOS(d.raw as ServiceOrder)}
                  className="col-span-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Anexos da OS (categorias)
                </button>
              </div>
            )}

            {d.kind === 'budget' && (d.raw as Budget).status === 'pending' && (
              <button
                onClick={() => approveBudgetForOS((d.raw as Budget).id)}
                className="w-full mb-3 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                Aprovar Orçamento
              </button>
            )}

            {d.kind !== 'sale' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownload(d)}
                  className="flex-1 min-w-[110px] px-3 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 text-sm"
                  title="Baixar PDF"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={() => handlePrint(d)}
                  className="flex-1 min-w-[110px] px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2 text-sm"
                  title="Imprimir"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDownload(d)}
                    className="flex-1 min-w-[140px] px-3 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 flex items-center justify-center gap-2 text-sm"
                    title="Baixar PDF (Recibo/Cupom)"
                  >
                    <Download className="w-4 h-4" />
                    {(d.raw as Sale) ? getSaleReceiptLabel(d.raw as Sale) : 'Recibo'}
                  </button>
                  <button
                    onClick={() => handlePrint(d)}
                    className="flex-1 min-w-[140px] px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2 text-sm"
                    title="Imprimir (Recibo/Cupom)"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </button>
                </div>
                <button
                  onClick={() => openContractEditor(d.raw as Sale)}
                  className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Contrato (opcional)
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => handleAttach(d)}
                className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
                title="Anexar PDF do cliente"
              >
                <Paperclip className="w-4 h-4" />
                Anexar ({d.attachments.length})
              </button>
              {d.attachments.length > 0 && (
                <button
                  onClick={() => handleOpenFirstAttachment(d)}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-green-50 text-green-700 border border-green-100 rounded-lg hover:bg-green-100 text-sm"
                  title="Abrir o primeiro anexo"
                >
                  Ver anexo
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum documento encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Editar Documento */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                Editar {editingDoc.kind === 'os' ? 'OS' : editingDoc.kind === 'budget' ? 'Orçamento' : 'Venda'}
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            {editingDoc.kind === 'os' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Funcionário</label>
                    <select
                      value={osForm.userId}
                      onChange={(e) => setOsForm(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                    {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({(u.prefix || 'A').toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('users')}
                      className="mt-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium"
                    >
                      + Novo funcionário
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={osForm.status}
                      onChange={(e) => setOsForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="open">Aberto</option>
                      <option value="analyzing">Análise</option>
                      <option value="ready">Pronto</option>
                      <option value="delivered">Entregue</option>
                      <option value="canceled">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                    <input
                      value={osForm.customerName}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={osForm.isOver18}
                        onChange={(e) => setOsForm(prev => ({ ...prev, isOver18: e.target.checked }))}
                      />
                      Maior de 18
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                    <input
                      value={osForm.customerCPF}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerCPF: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input
                      value={osForm.customerPhone}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo do Aparelho</label>
                    <select
                      value={osForm.deviceType}
                      onChange={(e) => setOsForm(prev => ({ ...prev, deviceType: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="pc">PC</option>
                      <option value="notebook">Notebook</option>
                      <option value="console">Console</option>
                      <option value="outro">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marca/Modelo</label>
                    <input
                      value={osForm.deviceBrandModel}
                      onChange={(e) => setOsForm(prev => ({ ...prev, deviceBrandModel: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nº de Série</label>
                    <input
                      value={osForm.serialNumber}
                      onChange={(e) => setOsForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado físico / acessórios</label>
                    <input
                      value={osForm.physicalState}
                      onChange={(e) => setOsForm(prev => ({ ...prev, physicalState: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relato do cliente sobre o problema *</label>
                  <textarea
                    value={osForm.customerComplaint}
                    onChange={(e) => setOsForm(prev => ({ ...prev, customerComplaint: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="O que o cliente relatou sobre o defeito?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Serviços</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableServices.map(service => {
                      const checked = osForm.selectedServices.includes(service);
                      return (
                        <label key={service} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setOsForm(prev => ({
                                ...prev,
                                selectedServices: checked
                                  ? prev.selectedServices.filter(s => s !== service)
                                  : [...prev.selectedServices, service]
                              }));
                            }}
                          />
                          {service}
                        </label>
                      );
                    })}
                  </div>
                  {osForm.selectedServices.includes('Outros') && (
                    <input
                      className="w-full mt-2 px-3 py-2 border rounded-lg"
                      placeholder="Especifique o outro serviço"
                      value={osForm.otherService}
                      onChange={(e) => setOsForm(prev => ({ ...prev, otherService: e.target.value }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={osForm.notes}
                    onChange={(e) => setOsForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {editingDoc.kind === 'budget' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Funcionário</label>
                    <select
                      value={budgetForm.userId}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({(u.prefix || '?').toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={budgetForm.discount}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, discount: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                    <input
                      value={budgetForm.customerName}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                    <input
                      value={budgetForm.customerCPF}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerCPF: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input
                      value={budgetForm.customerPhone}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={budgetForm.notes}
                    onChange={(e) => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h4 className="font-bold text-gray-800">Peças / Serviços</h4>
                    <p className="text-xs text-gray-500">Desconto por item em R$ ou %</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white">
                        <tr className="text-gray-600">
                          <th className="px-4 py-3 text-left">Tipo</th>
                          <th className="px-4 py-3 text-left">Descrição</th>
                          <th className="px-4 py-3 text-center">Qtd</th>
                          <th className="px-4 py-3 text-right">Unit</th>
                          <th className="px-4 py-3 text-center">Desc</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {budgetItems.map((it) => (
                          <tr key={it.id}>
                            <td className="px-4 py-2">
                              <select
                                value={it.type}
                                onChange={(e) => {
                                  const type = e.target.value as BudgetItem['type'];
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, type } : x));
                                }}
                                className="px-2 py-1 border rounded-lg"
                              >
                                <option value="part">Peça</option>
                                <option value="service">Serviço</option>
                                <option value="console">Console</option>
                                <option value="accessory">Acessório</option>
                                <option value="trade_in">Troca</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 min-w-[240px]">
                              <input
                                value={it.description}
                                onChange={(e) => {
                                  const description = e.target.value;
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, description } : x));
                                }}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                value={it.quantity}
                                onChange={(e) => {
                                  const quantity = Number(e.target.value);
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, quantity } : x));
                                }}
                                className="w-20 px-2 py-2 border rounded-lg text-center"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={it.unitPrice}
                                onChange={(e) => {
                                  const unitPrice = Number(e.target.value);
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, unitPrice } : x));
                                }}
                                className="w-28 px-2 py-2 border rounded-lg text-right"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 items-center justify-center">
                                <select
                                  value={it.discountType || 'value'}
                                  onChange={(e) => {
                                    const discountType = e.target.value as NonNullable<BudgetItem['discountType']>;
                                    setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, discountType } : x));
                                  }}
                                  className="px-2 py-2 border rounded-lg"
                                  title="Tipo de desconto"
                                >
                                  <option value="value">R$</option>
                                  <option value="percent">%</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={it.discountValue || 0}
                                  onChange={(e) => {
                                    const discountValue = Number(e.target.value);
                                    setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, discountValue } : x));
                                  }}
                                  className="w-24 px-2 py-2 border rounded-lg text-right"
                                  title="Valor do desconto"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-purple-700">
                              R$ {calcItemTotal(it).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setBudgetItems(prev => prev.filter(x => x.id !== it.id))}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Remover item"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}

                        {budgetItems.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                              Nenhum item no orçamento
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-gray-50 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                        <select
                          value={newBudgetItem.type}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="part">Peça</option>
                          <option value="service">Serviço</option>
                          <option value="console">Console</option>
                          <option value="accessory">Acessório</option>
                          <option value="trade_in">Troca</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Descrição</label>
                        <input
                          value={newBudgetItem.description}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Ex: Troca de tela / SSD 480GB"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                        <input
                          type="number"
                          min={0}
                          value={newBudgetItem.quantity}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={newBudgetItem.unitPrice}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Desc</label>
                        <div className="flex gap-2">
                          <select
                            value={newBudgetItem.discountType}
                            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, discountType: e.target.value as any }))}
                            className="px-2 py-2 border rounded-lg text-sm"
                          >
                            <option value="value">R$</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={newBudgetItem.discountValue}
                            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                            className="flex-1 px-2 py-2 border rounded-lg text-sm text-right"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Subtotal itens:</span>{' '}
                        R$ {calcBudgetSubtotal(budgetItems.map(it => ({ ...it, totalPrice: calcItemTotal(it) }))).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newBudgetItem.description.trim()) return;
                          const id = Math.random().toString(36).slice(2, 9);
                          const item: BudgetItem = {
                            id,
                            type: newBudgetItem.type,
                            description: newBudgetItem.description.trim(),
                            quantity: Number(newBudgetItem.quantity) || 0,
                            unitPrice: Number(newBudgetItem.unitPrice) || 0,
                            discountType: newBudgetItem.discountType,
                            discountValue: Number(newBudgetItem.discountValue) || 0,
                            totalPrice: 0,
                          };
                          item.totalPrice = calcItemTotal(item);
                          setBudgetItems(prev => [...prev, item]);
                          setNewBudgetItem({
                            type: 'part',
                            description: '',
                            quantity: 1,
                            unitPrice: 0,
                            discountType: 'value',
                            discountValue: 0,
                          });
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                      >
                        Adicionar item
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editingDoc.kind === 'sale' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cliente (Venda)</label>
                  <input
                    value={saleForm.customerName}
                    onChange={(e) => setSaleForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Nome do cliente (opcional)"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Os itens/valores da venda não são editáveis aqui (pra não quebrar o caixa). Posso adicionar ajustes controlados se você precisar.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingDoc(null)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Documento */}
      {creatingKind && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {creatingKind === 'os' ? 'Nova OS' : 'Novo Orçamento'}
              </h3>
              <button
                onClick={() => setCreatingKind(null)}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            {creatingKind === 'os' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Funcionário</label>
                    <select
                      value={osForm.userId}
                      onChange={(e) => setOsForm(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({(u.prefix || '?').toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={osForm.status}
                      onChange={(e) => setOsForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="open">Aberto</option>
                      <option value="analyzing">Análise</option>
                      <option value="ready">Pronto</option>
                      <option value="delivered">Entregue</option>
                      <option value="canceled">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                    <input
                      value={osForm.customerName}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={osForm.isOver18}
                        onChange={(e) => setOsForm(prev => ({ ...prev, isOver18: e.target.checked }))}
                      />
                      Maior de 18
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                    <input
                      value={osForm.customerCPF}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerCPF: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                    <input
                      value={osForm.customerPhone}
                      onChange={(e) => setOsForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo do Aparelho</label>
                    <select
                      value={osForm.deviceType}
                      onChange={(e) => setOsForm(prev => ({ ...prev, deviceType: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="pc">PC</option>
                      <option value="notebook">Notebook</option>
                      <option value="console">Console</option>
                      <option value="outro">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marca/Modelo *</label>
                    <input
                      value={osForm.deviceBrandModel}
                      onChange={(e) => setOsForm(prev => ({ ...prev, deviceBrandModel: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Ex: iPhone 15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relato do cliente sobre o problema *</label>
                  <textarea
                    value={osForm.customerComplaint}
                    onChange={(e) => setOsForm(prev => ({ ...prev, customerComplaint: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="O que o cliente relatou sobre o defeito?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Serviços</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableServices.map(service => {
                      const checked = osForm.selectedServices.includes(service);
                      return (
                        <label key={service} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setOsForm(prev => ({
                                ...prev,
                                selectedServices: checked
                                  ? prev.selectedServices.filter(s => s !== service)
                                  : [...prev.selectedServices, service]
                              }));
                            }}
                          />
                          {service}
                        </label>
                      );
                    })}
                  </div>
                  {osForm.selectedServices.includes('Outros') && (
                    <input
                      className="w-full mt-2 px-3 py-2 border rounded-lg"
                      placeholder="Especifique o outro serviço"
                      value={osForm.otherService}
                      onChange={(e) => setOsForm(prev => ({ ...prev, otherService: e.target.value }))}
                    />
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateBudgetAfterOS}
                    onChange={(e) => setGenerateBudgetAfterOS(e.target.checked)}
                  />
                  Gerar orçamento automaticamente após criar OS
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Funcionário</label>
                    <select
                      value={budgetForm.userId}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, userId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({(u.prefix || '?').toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={budgetForm.discount}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, discount: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cliente *</label>
                    <input
                      value={budgetForm.customerName}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CPF *</label>
                    <input
                      value={budgetForm.customerCPF}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerCPF: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                    <input
                      value={budgetForm.customerPhone}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* Reaproveita editor de itens já existente no modal de editar */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h4 className="font-bold text-gray-800">Peças / Serviços</h4>
                    <p className="text-xs text-gray-500">Desconto por item em R$ ou %</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white">
                        <tr className="text-gray-600">
                          <th className="px-4 py-3 text-left">Tipo</th>
                          <th className="px-4 py-3 text-left">Descrição</th>
                          <th className="px-4 py-3 text-center">Qtd</th>
                          <th className="px-4 py-3 text-right">Unit</th>
                          <th className="px-4 py-3 text-center">Desc</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {budgetItems.map((it) => (
                          <tr key={it.id}>
                            <td className="px-4 py-2">
                              <select
                                value={it.type}
                                onChange={(e) => {
                                  const type = e.target.value as BudgetItem['type'];
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, type } : x));
                                }}
                                className="px-2 py-1 border rounded-lg"
                              >
                                <option value="part">Peça</option>
                                <option value="service">Serviço</option>
                                <option value="console">Console</option>
                                <option value="accessory">Acessório</option>
                                <option value="trade_in">Troca</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 min-w-[240px]">
                              <input
                                value={it.description}
                                onChange={(e) => {
                                  const description = e.target.value;
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, description } : x));
                                }}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                value={it.quantity}
                                onChange={(e) => {
                                  const quantity = Number(e.target.value);
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, quantity } : x));
                                }}
                                className="w-20 px-2 py-2 border rounded-lg text-center"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={it.unitPrice}
                                onChange={(e) => {
                                  const unitPrice = Number(e.target.value);
                                  setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, unitPrice } : x));
                                }}
                                className="w-28 px-2 py-2 border rounded-lg text-right"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 items-center justify-center">
                                <select
                                  value={it.discountType || 'value'}
                                  onChange={(e) => {
                                    const discountType = e.target.value as NonNullable<BudgetItem['discountType']>;
                                    setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, discountType } : x));
                                  }}
                                  className="px-2 py-2 border rounded-lg"
                                >
                                  <option value="value">R$</option>
                                  <option value="percent">%</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={it.discountValue || 0}
                                  onChange={(e) => {
                                    const discountValue = Number(e.target.value);
                                    setBudgetItems(prev => prev.map(x => x.id === it.id ? { ...x, discountValue } : x));
                                  }}
                                  className="w-24 px-2 py-2 border rounded-lg text-right"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-purple-700">
                              R$ {calcItemTotal(it).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setBudgetItems(prev => prev.filter(x => x.id !== it.id))}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}

                        {budgetItems.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                              Nenhum item no orçamento
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-gray-50 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                        <select
                          value={newBudgetItem.type}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="part">Peça</option>
                          <option value="service">Serviço</option>
                          <option value="console">Console</option>
                          <option value="accessory">Acessório</option>
                          <option value="trade_in">Troca</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Descrição</label>
                        <input
                          value={newBudgetItem.description}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="Ex: Troca de tela / SSD 480GB"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                        <input
                          type="number"
                          min={0}
                          value={newBudgetItem.quantity}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={newBudgetItem.unitPrice}
                          onChange={(e) => setNewBudgetItem(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Desc</label>
                        <div className="flex gap-2">
                          <select
                            value={newBudgetItem.discountType}
                            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, discountType: e.target.value as any }))}
                            className="px-2 py-2 border rounded-lg text-sm"
                          >
                            <option value="value">R$</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={newBudgetItem.discountValue}
                            onChange={(e) => setNewBudgetItem(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                            className="flex-1 px-2 py-2 border rounded-lg text-sm text-right"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Subtotal itens:</span>{' '}
                        R$ {calcBudgetSubtotal(budgetItems.map(it => ({ ...it, totalPrice: calcItemTotal(it) }))).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newBudgetItem.description.trim()) return;
                          const id = Math.random().toString(36).slice(2, 9);
                          const item: BudgetItem = {
                            id,
                            type: newBudgetItem.type,
                            description: newBudgetItem.description.trim(),
                            quantity: Number(newBudgetItem.quantity) || 0,
                            unitPrice: Number(newBudgetItem.unitPrice) || 0,
                            discountType: newBudgetItem.discountType,
                            discountValue: Number(newBudgetItem.discountValue) || 0,
                            totalPrice: 0,
                          };
                          item.totalPrice = calcItemTotal(item);
                          setBudgetItems(prev => [...prev, item]);
                          setNewBudgetItem({
                            type: 'part',
                            description: '',
                            quantity: 1,
                            unitPrice: 0,
                            discountType: 'value',
                            discountValue: 0,
                          });
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                      >
                        Adicionar item
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCreatingKind(null)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveCreate}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {diagnosisOS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Diagnóstico técnico - OS {diagnosisOS.externalId}</h3>
            <div className="space-y-3">
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Problema identificado" value={diagnosisForm.problemFound} onChange={(e) => setDiagnosisForm(prev => ({ ...prev, problemFound: e.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Testes realizados" value={diagnosisForm.testsPerformed} onChange={(e) => setDiagnosisForm(prev => ({ ...prev, testsPerformed: e.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Peças necessárias" value={diagnosisForm.requiredParts} onChange={(e) => setDiagnosisForm(prev => ({ ...prev, requiredParts: e.target.value }))} />
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Observações do técnico" value={diagnosisForm.technicianNotes} onChange={(e) => setDiagnosisForm(prev => ({ ...prev, technicianNotes: e.target.value }))} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDiagnosisOS(null)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmitDiagnosis} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Salvar diagnóstico</button>
            </div>
          </div>
        </div>
      )}

      {paymentOS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl">
            <h3 className="text-xl font-bold mb-4">Pagamento - OS {paymentOS.externalId}</h3>
            <div className="grid grid-cols-2 gap-3">
              <select className="px-3 py-2 border rounded-lg" value={paymentForm.type} onChange={(e) => setPaymentForm(prev => ({ ...prev, type: e.target.value as PaymentEntry['type'] }))}>
                <option value="entrada">Recibo de entrada</option>
                <option value="parcela">Recibo de parcela</option>
                <option value="quitacao">Recibo de quitação</option>
                <option value="avista">Pagamento à vista</option>
              </select>
              <select className="px-3 py-2 border rounded-lg" value={paymentForm.method} onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value as PaymentEntry['method'] }))}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Cartão débito</option>
                <option value="credito">Cartão crédito</option>
              </select>
              <input type="number" className="px-3 py-2 border rounded-lg" placeholder="Valor" value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: Number(e.target.value) }))} />
              <input type="number" className="px-3 py-2 border rounded-lg" placeholder="Parcela atual" value={paymentForm.installmentNumber} onChange={(e) => setPaymentForm(prev => ({ ...prev, installmentNumber: Number(e.target.value) }))} />
              <input type="number" className="px-3 py-2 border rounded-lg" placeholder="Total parcelas" value={paymentForm.installmentsTotal} onChange={(e) => setPaymentForm(prev => ({ ...prev, installmentsTotal: Number(e.target.value) }))} />
              <input className="px-3 py-2 border rounded-lg" placeholder="Observações" value={paymentForm.notes} onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaymentOS(null)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleRegisterPayment} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700">Registrar e gerar recibo</button>
            </div>
          </div>
        </div>
      )}

      {attachOS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Anexos por categoria - OS {attachOS.externalId}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('os_signed')}>OS assinada</button>
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('budget_signed')}>Orçamento assinado</button>
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('contract_signed')}>Contrato assinado</button>
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('receipt_signed')}>Recibo assinado</button>
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('photo')}>Foto do aparelho</button>
              <button className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => handleCategorizedAttach('video')}>Vídeo do aparelho</button>
            </div>
            <button onClick={() => setAttachOS(null)} className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Editar Contrato */}
      {editingContractSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Editar Contrato da Venda</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Cliente</label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  value={contractForm.client}
                  onChange={(e) => setContractForm(prev => ({ ...prev, client: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">CPF</label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  value={contractForm.cpf}
                  onChange={(e) => setContractForm(prev => ({ ...prev, cpf: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Valor Total</label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  value={contractForm.total}
                  onChange={(e) => setContractForm(prev => ({ ...prev, total: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Objeto</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  rows={3}
                  value={contractForm.objeto}
                  onChange={(e) => setContractForm(prev => ({ ...prev, objeto: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Forma de Pagamento</label>
                <input
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                  value={contractForm.payment}
                  onChange={(e) => setContractForm(prev => ({ ...prev, payment: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingContractSale(null)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateContract}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
              >
                Gerar Contrato PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

