import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import { Customer } from '../types';
import { formatMinutesBr, minutesToReais } from '../utils/formatMinutesBr';
import { Users, Plus, Edit, Trash2, Search, Phone, Mail, X, Clock, Wallet, Eye, EyeOff, CreditCard, Key } from 'lucide-react';

export function Customers() {
  const { customers, sales, addCustomer, updateCustomer, deleteCustomer, addCredits, removeCredits } = useStore();
  const { settings } = useSettingsStore();
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<'add' | 'remove'>('add');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    credits: '0',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customerSales = selectedCustomer
    ? sales.filter(s => s.customerName === selectedCustomer.name)
    : [];

  const resetForm = () => {
    setFormData({ name: '', username: '', password: '', phone: '', email: '', credits: '0' });
    setEditingCustomer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customerData = {
      name: formData.name,
      username: formData.username,
      password: formData.password,
      phone: formData.phone,
      email: formData.email,
      credits: Number(formData.credits),
      balance: 0,
    };

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, customerData);
    } else {
      addCustomer(customerData as any);
    }

    setShowModal(false);
    resetForm();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      username: customer.username,
      password: customer.password,
      phone: customer.phone || '',
      email: customer.email || '',
      credits: customer.credits.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      deleteCustomer(id);
    }
  };

  const handleCredits = () => {
    if (!selectedCustomer || !creditAmount) return;
    
    const amount = Number(creditAmount);
    if (creditType === 'add') {
      addCredits(selectedCustomer.id, amount);
    } else {
      removeCredits(selectedCustomer.id, amount);
    }
    
    setShowCreditsModal(false);
    setSelectedCustomer(null);
    setCreditAmount('');
  };

  const handleChangePassword = () => {
    if (!selectedCustomer) return;
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    
    updateCustomer(selectedCustomer.id, { password: passwordData.newPassword });
    setShowPasswordModal(false);
    setSelectedCustomer(null);
    setPasswordData({ newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500">Gerencie seus clientes e créditos</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
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
          placeholder="Buscar clientes por nome, usuário ou telefone..."
        />
      </div>

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCreditsModal(true);
                  }}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  title="Gerenciar Créditos"
                >
                  <Wallet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowPasswordModal(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Alterar Senha"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleEdit(customer)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(customer.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="font-semibold text-lg">{customer.name}</h3>
            <p className="text-sm text-gray-500 mb-3">@{customer.username}</p>

            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Phone className="w-4 h-4" />
                {customer.phone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <Mail className="w-4 h-4" />
                {customer.email}
              </div>
            )}

            {/* Créditos */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Saldo (tempo)</span>
                <span className={`font-semibold ${customer.credits > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatMinutesBr(customer.credits)}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                <span>Equiv. tarifa PC/h (config.)</span>
                <span className="font-medium text-gray-700">
                  ≈ R$ {minutesToReais(customer.credits, settings.pcPricePerHour).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total gasto</span>
                <span className="font-semibold text-purple-600">
                  R$ {customer.totalSpent.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum cliente encontrado</p>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (para login)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  placeholder="Ex: joao123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Créditos iniciais (minutos)</label>
                  <input
                    type="number"
                    value={formData.credits}
                    onChange={(e) => setFormData(prev => ({ ...prev, credits: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Ex: 60 = 1 hora de crédito</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingCustomer ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Créditos */}
      {showCreditsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Gerenciar Créditos</h3>
              <button onClick={() => { setShowCreditsModal(false); setSelectedCustomer(null); }} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-600">{selectedCustomer.name}</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {formatMinutesBr(selectedCustomer.credits)}
              </p>
              <p className="text-sm text-gray-500">de tempo disponível</p>
              <p className="text-xs text-gray-500 mt-1">
                ≈ R$ {minutesToReais(selectedCustomer.credits, settings.pcPricePerHour).toFixed(2)} (tarifa PC/h nas configurações)
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCreditType('add')}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                    creditType === 'add' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Adicionar
                </button>
                <button
                  onClick={() => setCreditType('remove')}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                    creditType === 'remove' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Remover
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade (minutos) — ou some com os atalhos abaixo
                </label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: 60"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total digitado: <strong>{formatMinutesBr(Number(creditAmount) || 0)}</strong>
                  {' · '}
                  ≈ R$ {minutesToReais(Number(creditAmount) || 0, settings.pcPricePerHour).toFixed(2)}
                </p>
              </div>

              {/* Atalhos: somam ao valor do campo */}
              <div className="flex flex-wrap gap-2">
                {[10, 30, 60, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      setCreditAmount(String((Number(creditAmount) || 0) + mins))
                    }
                    className="flex-1 min-w-[4.5rem] py-2 px-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                  >
                    +{mins === 60 ? '1h' : mins === 120 ? '2h' : `${mins}min`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCreditAmount('0')}
                  className="py-2 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Zerar
                </button>
              </div>

              <button
                onClick={handleCredits}
                disabled={!creditAmount}
                className={`w-full py-3 rounded-lg text-white font-medium ${
                  creditType === 'add' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {creditType === 'add' ? 'Adicionar Créditos' : 'Remover Créditos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alterar Senha */}
      {showPasswordModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Alterar Senha</h3>
              <button onClick={() => { setShowPasswordModal(false); setSelectedCustomer(null); }} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">Cliente: {selectedCustomer.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={!passwordData.newPassword || !passwordData.confirmPassword}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Alterar Senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
