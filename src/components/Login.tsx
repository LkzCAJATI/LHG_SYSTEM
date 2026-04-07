import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Monitor, Lock, User, Gamepad2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useStore(state => state.login);
  const { settings } = useSettingsStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (login(username, password)) {
      // Login bem sucedido
    } else {
      setError('Usuário ou senha inválidos');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          {settings.logo ? (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4 overflow-hidden">
              <img src={settings.logo} alt="Logo do sistema" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
              <Gamepad2 className="w-10 h-10 text-purple-600" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-800">{settings.systemName}</h1>
          <p className="text-gray-500 mt-2">Sistema de Gerenciamento de LAN House</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite seu usuário"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite sua senha"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <Monitor className="w-5 h-5" />
            Entrar no Sistema
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Usuário padrão: <strong>admin</strong></p>
          <p>Senha padrão: <strong>admin123</strong></p>
        </div>
      </div>
    </div>
  );
}
