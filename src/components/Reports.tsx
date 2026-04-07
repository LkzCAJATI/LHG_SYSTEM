import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  BarChart3, Calendar, DollarSign, Package, TrendingUp,
  Filter
} from 'lucide-react';

export function Reports() {
  const { sales, products } = useStore();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [reportType, setReportType] = useState<'sales' | 'stock' | 'financial'>('sales');

  const filterByPeriod = (date: Date) => {
    const now = new Date();
    const itemDate = new Date(date);
    
    switch (period) {
      case 'today':
        return itemDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return itemDate >= monthAgo;
      default:
        return true;
    }
  };

  const filteredSales = sales.filter(s => filterByPeriod(s.createdAt));

  const stats = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const salesCount = filteredSales.length;
    
    const productSales = filteredSales.reduce((acc, sale) => {
      sale.items.forEach(item => {
        if (item.type === 'product') {
          acc.quantity += item.quantity;
          acc.revenue += item.totalPrice;
        }
      });
      return acc;
    }, { quantity: 0, revenue: 0 });

    const timeSales = filteredSales.reduce((acc, sale) => {
      sale.items.forEach(item => {
        if (item.type === 'time') {
          acc.quantity += 1;
          acc.revenue += item.totalPrice;
        }
      });
      return acc;
    }, { quantity: 0, revenue: 0 });

    const paymentMethods = filteredSales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
      return acc;
    }, {} as Record<string, number>);

    const topProducts = filteredSales.reduce((acc, sale) => {
      sale.items.forEach(item => {
        if (item.type === 'product') {
          if (!acc[item.name]) {
            acc[item.name] = { quantity: 0, revenue: 0 };
          }
          acc[item.name].quantity += item.quantity;
          acc[item.name].revenue += item.totalPrice;
        }
      });
      return acc;
    }, {} as Record<string, { quantity: number; revenue: number }>);

    return {
      totalSales,
      salesCount,
      productSales,
      timeSales,
      paymentMethods,
      topProducts,
      averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
    };
  }, [filteredSales]);

  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Dinheiro';
      case 'pix': return 'PIX';
      case 'card': return 'Cartão';
      default: return method;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
          <p className="text-gray-500">Análises e indicadores do negócio</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Período:</span>
          <div className="flex gap-2">
            {[
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: '7 dias' },
              { value: 'month', label: '30 dias' },
              { value: 'all', label: 'Tudo' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value as any)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  period === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Tipo:</span>
          <div className="flex gap-2">
            {[
              { value: 'sales', label: 'Vendas' },
              { value: 'stock', label: 'Estoque' },
              { value: 'financial', label: 'Financeiro' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setReportType(opt.value as any)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  reportType === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Total de Vendas</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalSales)}</p>
          <p className="text-sm text-gray-500">{stats.salesCount} vendas</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Venda Média</span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.averageTicket)}</p>
          <p className="text-sm text-gray-500">por atendimento</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Produtos Vendidos</span>
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.productSales.quantity}</p>
          <p className="text-sm text-gray-500">{formatCurrency(stats.productSales.revenue)}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Tempo Vendido</span>
            <Calendar className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.timeSales.quantity}</p>
          <p className="text-sm text-gray-500">{formatCurrency(stats.timeSales.revenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Método de Pagamento */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            Vendas por Pagamento
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.paymentMethods).map(([method, value]) => (
              <div key={method} className="flex items-center justify-between">
                <span className="text-gray-600">{getPaymentLabel(method)}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${(value / stats.totalSales) * 100}%` }}
                    />
                  </div>
                  <span className="font-medium w-24 text-right">{formatCurrency(value)}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.paymentMethods).length === 0 && (
              <p className="text-center text-gray-500 py-4">Nenhuma venda no período</p>
            )}
          </div>
        </div>

        {/* Produtos Mais Vendidos */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Produtos Mais Vendidos
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.topProducts)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .slice(0, 5)
              .map(([name, data]) => (
                <div key={name} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-gray-500">{data.quantity} unidades</p>
                  </div>
                  <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                </div>
              ))}
            {Object.keys(stats.topProducts).length === 0 && (
              <p className="text-center text-gray-500 py-4">Nenhuma venda no período</p>
            )}
          </div>
        </div>

        {/* Produtos com Estoque Baixo */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-red-600" />
            Estoque Baixo
          </h3>
          <div className="space-y-3">
            {lowStockProducts.map(product => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">Mínimo: {product.minStock}</p>
                </div>
                <span className="font-bold text-red-600">{product.quantity} un</span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <p className="text-center text-green-600 py-4">
                ✓ Todos os produtos com estoque adequado
              </p>
            )}
          </div>
        </div>

        {/* Últimas Vendas */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Últimas Vendas
          </h3>
          <div className="space-y-3 max-h-64 overflow-auto">
            {filteredSales.slice(-10).reverse().map(sale => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">#{sale.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(sale.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(sale.total)}</p>
                  <p className="text-xs text-gray-500">{getPaymentLabel(sale.paymentMethod)}</p>
                </div>
              </div>
            ))}
            {filteredSales.length === 0 && (
              <p className="text-center text-gray-500 py-4">Nenhuma venda no período</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
