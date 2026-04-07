import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Budget, BudgetItem } from '../types';
import {
  FileText, Plus, Edit, Trash2, ShoppingCart,
  X, Search
} from 'lucide-react';

export function Budgets() {
  const { budgets, addBudget, updateBudget, deleteBudget, convertBudgetToSale, setCurrentPage } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    customerName: '',
    items: [] as BudgetItem[],
    discount: 0,
    notes: '',
  });

  const [newItem, setNewItem] = useState({
    type: 'part' as 'part' | 'service' | 'console' | 'accessory',
    description: '',
    quantity: 1,
    unitPrice: 0,
  });

  const filteredBudgets = budgets.filter(b =>
    b.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const itemTypes = [
    { value: 'part', label: 'Peça de Hardware' },
    { value: 'service', label: 'Serviço' },
    { value: 'console', label: 'Console/Periférico' },
    { value: 'accessory', label: 'Acessório' },
  ];

  const resetForm = () => {
    setFormData({
      customerName: '',
      items: [],
      discount: 0,
      notes: '',
    });
    setNewItem({
      type: 'part',
      description: '',
      quantity: 1,
      unitPrice: 0,
    });
    setEditingBudget(null);
  };

  const handleAddItem = () => {
    if (!newItem.description || newItem.unitPrice <= 0) return;

    const item: BudgetItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: newItem.type,
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      totalPrice: newItem.quantity * newItem.unitPrice,
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

    const subtotal = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal - formData.discount;

    const budgetData = {
      customerName: formData.customerName || undefined,
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
      addBudget(budgetData);
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
    convertBudgetToSale(budgetId);
    setCurrentPage('cashier');
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
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                {getStatusLabel(budget.status)}
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-1">#{budget.id.toUpperCase()}</p>
            <h3 className="font-bold text-lg mb-2">
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

            <div className="flex gap-2">
              {budget.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleEdit(budget.id)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleConvertToSale(budget.id)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Vender
                  </button>
                </>
              )}
              <button
                onClick={() => handleDelete(budget.id)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente (opcional)
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Nome do cliente"
                />
              </div>

              {/* Adicionar Item */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Adicionar Item</h4>
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
                  onClick={handleAddItem}
                  className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Adicionar
                </button>
              </div>

              {/* Lista de Itens */}
              {formData.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Tipo</th>
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
                            {itemTypes.find(t => t.value === item.type)?.label}
                          </td>
                          <td className="px-4 py-2">{item.description}</td>
                          <td className="px-4 py-2 text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-medium">R$ {item.totalPrice.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:bg-red-50 p-1 rounded"
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
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              {/* Resumo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {formData.discount > 0 && (
                  <div className="flex justify-between mb-2 text-red-600">
                    <span>Desconto:</span>
                    <span>-R$ {formData.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formData.items.length === 0}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingBudget ? 'Salvar' : 'Criar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
