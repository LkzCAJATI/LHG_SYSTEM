import { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  Monitor, Package, Users, FileText,
  BarChart3, Settings, LogOut, DollarSign, Gamepad2, Wifi
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentUser, currentPage, setCurrentPage, logout } = useStore();
  const { settings } = useSettingsStore();

  const menuItems = [
    { id: 'cashier', label: 'Caixa (PDV)', icon: DollarSign },
    { id: 'dashboard', label: 'Dispositivos', icon: Monitor },
    { id: 'products', label: 'Estoque', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'budgets', label: 'Orçamentos', icon: FileText },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'network', label: 'Rede', icon: Wifi },
    { id: 'users', label: 'Usuários', icon: Settings },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const backgroundStyle = settings.systemBackground 
    ? { backgroundImage: `url(${settings.systemBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="min-h-screen bg-gray-900 flex" style={backgroundStyle}>
      {/* Overlay para melhor legibilidade */}
      {settings.systemBackground && (
        <div className="fixed inset-0 bg-black/70" />
      )}
      
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900/95 backdrop-blur text-white flex flex-col relative z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
            ) : (
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg truncate max-w-[140px]">{settings.systemName}</h1>
              <p className="text-xs text-gray-400">Sistema (v1.0.0)</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentPage(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{currentUser?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{currentUser?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative z-10">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
