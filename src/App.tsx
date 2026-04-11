import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { useNetworkStore } from './store/networkStore';
import { useSettingsStore } from './store/settingsStore';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Cashier } from './components/Cashier';
import { Dashboard } from './components/Dashboard';
import { Products } from './components/Products';
import { Customers } from './components/Customers';
import { Budgets } from './components/Budgets';
import { Reports } from './components/Reports';
import { Users } from './components/Users';
import Network from './components/Network';
import Settings from './components/Settings';
import ServiceOrders from './components/ServiceOrders';
import ClientView from './components/ClientView';
import DocumentsManager from './components/DocumentsManager';
import { sessionRemainingSeconds, sessionTotalSeconds } from './utils/sessionRemaining';

interface AppProps {
  installMode?: 'server' | 'client';
}

function App({ installMode = 'server' }: AppProps) {
  if (installMode === 'client') {
    return <ClientView />;
  }

  const { initializeIpc } = useNetworkStore();
  const { clients } = useNetworkStore();
  const { currentUser, currentPage, devices } = useStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (installMode === 'server') {
      initializeIpc();
    }
  }, [installMode, initializeIpc]);

  // Sincronização Mobile
  useEffect(() => {
    if (installMode === 'server' && window.lhgSystem?.syncSessions) {
      const syncData = devices.map(d => {
        const session = d.currentSession;
        const nowMs = new Date().getTime();
        const totalDuration = session ? sessionTotalSeconds(session) : 0;
        const remaining = session ? sessionRemainingSeconds(session, nowMs) : 0;
        const netClient = clients.find(c => c.id === d.id);

        return {
          id: d.id,
          name: d.name,
          type: d.type,
          status: d.status,
          timeRemaining: remaining,
          totalDuration: totalDuration,
          customer: session?.customerName || null,
          connected: netClient ? Boolean(netClient.connected) : false,
          mac: d.mac || null
        };
      });
      window.lhgSystem.syncSessions({
        devices: syncData,
        systemName: settings.systemName || 'LHG SYSTEM',
        logo: settings.logo || null
      });
    }
  }, [devices, clients, installMode, settings.systemName, settings.logo]);

  if (!currentUser) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'cashier':
        return <Cashier />;
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'customers':
        return <Customers />;
      case 'budgets':
        return <Budgets />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <Users />;
      case 'network':
        return <Network />;
      case 'service-orders':
        return <ServiceOrders />;
      case 'client-docs':
        return <DocumentsManager />;
      case 'settings':
        return <Settings />;
      default:
        return <Cashier />;
    }
  };

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
}

export default App;
