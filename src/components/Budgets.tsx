import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Budget, BudgetItem, Product } from '../types';
import {
  FileText, Plus, Edit, Trash2, ShoppingCart,
  X, Search, Download, Printer, Package
} from 'lucide-react';
import { generateBudgetPDF } from '../utils/pdfGenerator';
import { useSettingsStore } from '../store/settingsStore';

export function Budgets() {
  const { budgets, products, users, currentUser, addBudget, updateBudget, deleteBudget, convertBudgetToSale, setCurrentPage } = useStore();
  const { settings } = useSettingsStore();
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [formData, setFormData] = useState({
    customerName: '',
    customerCPF: '',
    customerPhone: '',
    items: [] as BudgetItem[],
    discount: 0,
    notes: '',
  });

  const [newItem, setNewItem] = useState({
    type: 'part' as 'part' | 'service' | 'console' | 'accessory',
    description: '',
    quantity: 1,
    unitPrice: 0,
    imageUrl: '',
  });

  const filteredBudgets = budgets.filter(b =>
    b.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 5);

  const itemTypes = [
    { value: 'part', label: 'Peça de Hardware' },
    { value: 'service', label: 'Serviço' },
    { value: 'console', label: 'Console/Periférico' },
    { value: 'accessory', label: 'Acessório' },
  ];

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerCPF: '',
      customerPhone: '',
      items: [],
      discount: 0,
      notes: '',
    });
    setNewItem({
      type: 'part',
      description: '',
      quantity: 1,
      unitPrice: 0,
      imageUrl: '',
    });
    setEditingBudget(null);
    setProductSearch('');
    setSelectedUserId('');
  };

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
      setFormData(prev => ({ ...prev, items: [...prev.items, item] }));
      setProductSearch('');
      setShowProductSearch(false);
      return;
    }

    if (!newItem.description || newItem.unitPrice <= 0) return;

    const item: BudgetItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: newItem.type,
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      totalPrice: newItem.quantity * newItem.unitPrice,
      imageUrl: newItem.imageUrl,
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      type: 'part',
      description: '',
      quantity: 1,
      unitPrice: 0,
      imageUrl: '',
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim() || !formData.customerCPF.trim() || !formData.customerPhone.trim()) {
      alert('Preencha os dados do cliente: nome, CPF e telefone.');
      return;
    }

    const subtotal = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal - formData.discount;

    const budgetData = {
      customerName: formData.customerName || undefined,
      customerCPF: formData.customerCPF || undefined,
      customerPhone: formData.customerPhone || undefined,
      items: formData.items,
      subtotal,
      discount: formData.discount,
      total,
      notes: formData.notes || undefined,
      status: 'pending' as const,
    };

    if (editingBudget) {
      updateBudget(editingBudget, budgetData);
    } else {
      addBudget(budgetData as any, selectedUserId || currentUser?.id);
    }

    setShowModal(false);
    resetForm();
  };

  const handleEdit = (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    setEditingBudget(budgetId);
    setFormData({
      customerName: budget.customerName || '',
      customerCPF: budget.customerCPF || '',
      customerPhone: budget.customerPhone || '',
      items: budget.items,
      discount: budget.discount,
      notes: budget.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este orçamento?')) {
      deleteBudget(id);
    }
  };

  const handleConvertToSale = (budgetId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    if (confirm(`Deseja aprovar e converter em Venda? Valor: R$ ${budget.total.toFixed(2)}`)) {
      const installmentsCount = budget.total > 100 ? parseInt(prompt('Número de parcelas (1 para à vista):', '1') || '1') : 1;
      const method = installmentsCount > 1 ? 'installment' : 'cash';
      
      convertBudgetToSale(budgetId, method, installmentsCount);
      setCurrentPage('cashier');
      alert('Venda gerada com sucesso! Verifique no Caixa.');
    }
  };

  const getStatusColor = (status: Budget['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'converted':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: Budget['status']) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'approved':
        return 'Aprovado';
      case 'converted':
        return 'Convertido';
      default:
        return status;
    }
  };

  const subtotal = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const total = subtotal - formData.discount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orçamentos</h1>
          <p className="text-gray-500">Orçamentos para peças, hardware e serviços</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border rounded-xl"
          placeholder="Buscar orçamentos..."
        />
      </div>

      {/* Lista de Orçamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBudgets.map(budget => (
          <div key={budget.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                  {getStatusLabel(budget.status)}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {new Date(budget.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-1">#{budget.id.toUpperCase()}</p>
            <h3 className="font-bold text-lg mb-2 truncate">
              {budget.customerName || 'Cliente não informado'}
            </h3>
            
            <div className="text-sm text-gray-600 mb-3">
              {budget.items.length} item(s)
            </div>

            <div className="flex items-center justify-between pt-3 border-t mb-4">
              <span className="text-gray-600">Total:</span>
              <span className="text-xl font-bold text-purple-600">
                R$ {budget.total.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => handleEdit(budget.id)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1 text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleConvertToSale(budget.id)}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 text-sm font-medium"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Aprovar Venda
                </button>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => generateBudgetPDF(budget, settings, 'download')}
                  className="flex-1 px-3 py-2 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 flex items-center justify-center gap-1 text-sm"
                  title="Baixar PDF"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={() => generateBudgetPDF(budget, settings, 'print')}
                  className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-1 text-sm"
                  title="Imprimir"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
                <button
                  onClick={() => handleDelete(budget.id)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredBudgets.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum orçamento encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Orçamento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingBudget && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Funcionário Responsável
                  </label>
                  <select
                    value={selectedUserId || currentUser?.id || ''}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({(u.prefix || '?').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF *
                  </label>
                  <input
                    type="text"
                    value={formData.customerCPF}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerCPF: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>

              {/* Busca no Estoque */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adicionar do Estoque
                </label>
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
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                    placeholder="Buscar produto por nome ou código..."
                  />
                </div>

                {showProductSearch && productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-xl overflow-hidden">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddItem(product)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 border-b last:border-0"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">Estoque: {product.quantity} un</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-purple-600">R$ {product.price.toFixed(2)}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="p-4 text-center text-sm text-gray-500">Nenhum produto encontrado</p>
                    )}
                  </div>
                )}
              </div>

              {/* Adicionar Manualmente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Adicionar Item Manual</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                    <select
                      value={newItem.type}
                      onChange={(e) => setNewItem(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {itemTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Descrição</label>
                    <input
                      type="text"
                      value={newItem.description}
                      onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Descrição do item"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Preço</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.unitPrice}
                        onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Adicionar Item
                </button>
              </div>

              {/* Lista de Itens */}
              {formData.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-left">Descrição</th>
                        <th className="px-4 py-2 text-center">Qtd</th>
                        <th className="px-4 py-2 text-right">Preço</th>
                        <th className="px-4 py-2 text-right">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {formData.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-4 py-2">
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <p className="font-medium">{item.description}</p>
                            <p className="text-[10px] text-gray-500">{itemTypes.find(t => t.value === item.type)?.label}</p>
                          </td>
                          <td className="px-4 py-2 text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-bold text-purple-600">R$ {item.totalPrice.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Desconto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desconto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg h-[42px]"
                    placeholder="Notas adicionais..."
                  />
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div className="flex justify-between mb-2 text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {formData.discount > 0 && (
                  <div className="flex justify-between mb-2 text-sm text-red-600">
                    <span>Desconto:</span>
                    <span>-R$ {formData.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-purple-200">
                  <span>Total final:</span>
                  <span className="text-purple-600">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formData.items.length === 0}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 shadow-md shadow-purple-200 transition-all active:scale-[0.98]"
                >
                  {editingBudget ? 'Atualizar Orçamento' : 'Gerar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
