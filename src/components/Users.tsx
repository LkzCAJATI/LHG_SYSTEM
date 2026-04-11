import { useState } from 'react';
import { useStore } from '../store/useStore';
import { User } from '../types';
import {
  Plus, Edit, Trash2, Shield,
  User as UserIcon, Lock, X
} from 'lucide-react';

export function Users() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'employee' as 'admin' | 'employee',
    prefix: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      role: 'employee',
      prefix: '',
    });
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const updateData: Partial<User> = {
        name: formData.name,
        username: formData.username,
        role: formData.role,
        prefix: (formData.prefix || editingUser.prefix || '').toUpperCase(),
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateUser(editingUser.id, updateData);
    } else {
      addUser({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        prefix: (formData.prefix || formData.name?.trim()?.[0] || 'X').toUpperCase(),
      });
    }

    setShowModal(false);
    resetForm();
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      prefix: user.prefix || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) {
      alert('Você não pode excluir seu próprio usuário!');
      return;
    }
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      deleteUser(id);
    }
  };

  const getRoleLabel = (role: User['role']) => {
    return role === 'admin' ? 'Administrador' : 'Funcionário';
  };

  const getRoleColor = (role: User['role']) => {
    return role === 'admin'
      ? 'bg-purple-100 text-purple-700'
      : 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <p className="text-gray-500">Gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Lista de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                {user.role === 'admin' ? (
                  <Shield className="w-6 h-6 text-purple-600" />
                ) : (
                  <UserIcon className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <h3 className="font-bold text-lg mb-1">{user.name}</h3>
            <p className="text-gray-500 text-sm mb-3">@{user.username}</p>

            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
              {getRoleLabel(user.role)}
            </span>
            <span className="ml-2 px-2 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-700">
              {user.prefix || '?'}
            </span>

            {user.id === currentUser?.id && (
              <p className="text-xs text-purple-600 mt-3 font-medium">
                ✓ Você está logado
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Permissões */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Permissões por Nível
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Funcionalidade</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Funcionário</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3">Caixa (PDV)</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Dispositivos</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Estoque</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Clientes</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Orçamentos</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Relatórios</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Gerenciar Usuários</td>
                <td className="px-4 py-3 text-center text-green-600">✓</td>
                <td className="px-4 py-3 text-center text-red-600">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Usuário */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prefixo da OS/Orçamento (1 letra)
                </label>
                <input
                  type="text"
                  value={formData.prefix}
                  onChange={(e) => {
                    const v = (e.target.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
                    setFormData(prev => ({ ...prev, prefix: v }));
                  }}
                  onBlur={() => {
                    if (!formData.prefix) {
                      const fallback = (formData.name?.trim()?.[0] || 'X').toUpperCase();
                      setFormData(prev => ({ ...prev, prefix: fallback }));
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  placeholder="Ex: L"
                  maxLength={1}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: Lucas = L → L-01, L-02...
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nível de Acesso
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'employee' }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="employee">Funcionário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
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
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingUser ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
