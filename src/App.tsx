import { useStore } from './store/useStore';
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
import ClientView from './components/ClientView';

interface AppProps {
  installMode?: 'server' | 'client';
}

function App({ installMode = 'server' }: AppProps) {
  if (installMode === 'client') {
    return <ClientView />;
  }

  const { currentUser, currentPage } = useStore();

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
