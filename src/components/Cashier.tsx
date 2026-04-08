import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { CashBills } from '../types';
import {
  ShoppingCart, Plus, Minus, Trash2, CreditCard,
  Banknote, Smartphone, Gamepad2, Monitor, Package,
  Calculator, DollarSign, X, Barcode, Joystick, Zap, CheckCircle, Printer, FileText
} from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { useSettingsStore } from '../store/settingsStore';

export function Cashier() {
  const {
    devices, products, cart, cashRegister, customers,
    addToCart, removeFromCart, updateCartItem, clearCart,
    createSale, openCashRegister, closeCashRegister, addCashMovement
  } = useStore();
  const { settings } = useSettingsStore();

  const [showOpenCash, setShowOpenCash] = useState(false);
  const [showCloseCash, setShowCloseCash] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [hours, setHours] = useState(1);
  const [extraControllers, setExtraControllers] = useState(0);
  const [selectedConsoleType, setSelectedConsoleType] = useState<'xbox' | 'switch' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pix' | 'card' | 'mixed' | 'installment'>('cash');
  const [downPayment, setDownPayment] = useState({ amount: 0, method: 'cash' as any });
  const [cashReceived, setCashReceived] = useState('');
  const [bills, setBills] = useState<CashBills>({ 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'pc' | 'playstation' | 'console' | 'arcade'>('pc');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const total = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const change = paymentMethod === 'cash' ? Number(cashReceived) - total : 0;

  // Separar dispositivos por categoria
  const pcs = devices.filter(d => d.type === 'pc' && d.status === 'available');
  const playstations = devices.filter(d => d.type === 'playstation' && d.status === 'available');
  const consoles = devices.filter(d => d.type === 'console' && d.status === 'available');
  const arcades = devices.filter(d => d.type === 'arcade' && d.status === 'available');

  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);

  const handleOpenCash = () => {
    openCashRegister(bills);
    setShowOpenCash(false);
    setBills({ 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 });
  };

  const handleCloseCash = () => {
    closeCashRegister();
    setShowCloseCash(false);
  };

  const handleAddTimeToCart = () => {
    if (!selectedDevice) return;
    
    const device = devices.find(d => d.id === selectedDevice);
    if (!device) return;

    let pricePerHour = device.pricePerHour;
    let extraPrice = extraControllers * 3; // R$ 3 por controle extra
    let deviceName = device.name;
    
    // Preço por hora baseado no tipo
    if (device.type === 'pc') {
      pricePerHour = 5; // R$ 5/hora para PCs
    } else if (device.type === 'playstation') {
      pricePerHour = 6; // R$ 6/hora para PlayStation
      extraPrice = extraControllers * 3; // R$ 3 por controle extra
    } else if (device.type === 'console') {
      pricePerHour = 6; // R$ 6/hora para consoles compartilhados
      extraPrice = extraControllers * 3;
      if (selectedConsoleType) {
        deviceName = `${device.name} (${selectedConsoleType === 'xbox' ? 'Xbox' : 'Nintendo Switch'})`;
      }
    } else if (device.type === 'arcade') {
      pricePerHour = 5; // R$ 5/hora para fliperama
    }

    const totalPrice = (pricePerHour * hours) + extraPrice;

    addToCart({
      type: 'time',
      deviceId: device.id,
      name: `${deviceName} - ${hours}h${extraControllers > 0 ? ` (+${extraControllers} controles)` : ''}`,
      quantity: 1,
      unitPrice: totalPrice,
      totalPrice,
      duration: hours,
      extraControllers,
      customerId: selectedCustomerId || undefined,
      customerName: customerName || undefined,
    });

    setShowTimeModal(false);
    setSelectedDevice(null);
    setCustomerName('');
    setSelectedCustomerId(null);
    setHours(1);
    setExtraControllers(0);
    setSelectedConsoleType(null);
  };

  const handleAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.quantity <= 0) return;

    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
      updateCartItem(existingItem.id, {
        quantity: existingItem.quantity + 1,
        totalPrice: (existingItem.quantity + 1) * product.price,
      });
    } else {
      addToCart({
        type: 'product',
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      });
    }
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;

    const product = products.find(p => 
      p.barcode && p.barcode.toLowerCase() === barcodeSearch.toLowerCase()
    );

    if (product && product.quantity > 0) {
      handleAddProduct(product.id);
      setBarcodeSearch('');
      barcodeInputRef.current?.focus();
    } else {
      alert('Produto não encontrado ou sem estoque!');
    }
  };

  const handleFinishSale = () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash' && Number(cashReceived) < total) return;

    const sale = createSale(
      paymentMethod, 
      Number(cashReceived), 
      downPayment.amount > 0 ? { ...downPayment, date: new Date() } : undefined
    );
    if (sale) {
      // Generate fiscal receipt and open print flow
      generateReceiptPDF(sale, settings, 'print');
      setLastSale(sale);
      setShowPayment(false);
      setCashReceived('');
      setPaymentMethod('cash');
      setDownPayment({ amount: 0, method: 'cash' });
      setShowSuccessModal(true);
    }
  };

  const handleWithdraw = () => {
    const amount = Number(withdrawAmount);
    if (amount <= 0 || !withdrawReason) return;

    addCashMovement({
      type: 'exit',
      amount,
      description: `Sangria: ${withdrawReason}`,
    });

    setWithdrawAmount('');
    setWithdrawReason('');
    setShowWithdraw(false);
  };

  const initialTotal = Object.entries(bills).reduce((sum, [value, qty]) => {
    return sum + (Number(value) * qty);
  }, 0);

  // Função para obter o ícone do dispositivo
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'pc': return <Monitor className="w-6 h-6 mx-auto mb-1 text-purple-600" />;
      case 'playstation': return <Gamepad2 className="w-6 h-6 mx-auto mb-1 text-blue-600" />;
      case 'console': return <Joystick className="w-6 h-6 mx-auto mb-1 text-green-600" />;
      case 'arcade': return <Zap className="w-6 h-6 mx-auto mb-1 text-yellow-600" />;
      default: return <Monitor className="w-6 h-6 mx-auto mb-1 text-gray-600" />;
    }
  };

  // Função para renderizar botão de dispositivo
  const renderDeviceButton = (device: typeof devices[0]) => (
    <button
      key={device.id}
      onClick={() => {
        setSelectedDevice(device.id);
        setShowTimeModal(true);
      }}
      className="p-4 bg-gray-50 rounded-xl hover:bg-purple-50 hover:border-purple-200 border-2 border-gray-200 transition-all text-center hover:shadow-md"
    >
      {getDeviceIcon(device.type)}
      <p className="font-medium text-sm">{device.name}</p>
      <p className="text-xs text-gray-500 mt-1">
        R$ {device.pricePerHour.toFixed(2)}/h
      </p>
      {device.type !== 'pc' && device.type !== 'arcade' && (
        <p className="text-xs text-blue-500">+R$ 3,00/controle</p>
      )}
    </button>
  );

  if (!cashRegister) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <DollarSign className="w-10 h-10 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Caixa Fechado</h2>
          <p className="text-gray-500 mb-6">Abra o caixa para iniciar as operações</p>
          
          <button
            onClick={() => setShowOpenCash(true)}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Abrir Caixa
          </button>
        </div>

        {/* Modal Abrir Caixa */}
        {showOpenCash && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">Abertura de Caixa</h3>
              <p className="text-gray-500 mb-4">Informe as cédulas disponíveis:</p>
              
              <div className="space-y-3 mb-6">
                {[2, 5, 10, 20, 50, 100].map(value => (
                  <div key={value} className="flex items-center gap-4">
                    <span className="w-20 text-sm font-medium">R$ {value}</span>
                    <input
                      type="number"
                      min="0"
                      value={bills[value as keyof CashBills]}
                      onChange={(e) => setBills(prev => ({ ...prev, [value]: Number(e.target.value) }))}
                      className="flex-1 px-3 py-2 border rounded-lg"
                      placeholder="Quantidade"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Total inicial:</p>
                <p className="text-2xl font-bold text-purple-600">
                  R$ {initialTotal.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOpenCash(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenCash}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Caixa (PDV)</h1>
          <p className="text-gray-500">Saldo atual: R$ {cashRegister.currentAmount.toFixed(2)}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowWithdraw(true)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Sangria
          </button>
          <button
            onClick={() => setShowCloseCash(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Fechar Caixa
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produtos e Dispositivos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs para Dispositivos */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('pc')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'pc'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Monitor className="w-4 h-4" />
                PCs ({pcs.length})
              </button>
              <button
                onClick={() => setActiveTab('playstation')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'playstation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                PlayStation ({playstations.length})
              </button>
              <button
                onClick={() => setActiveTab('console')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'console'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Joystick className="w-4 h-4" />
                Consoles ({consoles.length})
              </button>
              <button
                onClick={() => setActiveTab('arcade')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'arcade'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Zap className="w-4 h-4" />
                Fliperama ({arcades.length})
              </button>
            </div>

            <div className="p-4">
              {/* Descrição da categoria */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  {activeTab === 'pc' && (
                    <p className="text-sm text-gray-500">R$ 5,00/hora - Controle por rede LAN</p>
                  )}
                  {activeTab === 'playstation' && (
                    <p className="text-sm text-gray-500">R$ 6,00/hora + R$ 3,00 por controle extra</p>
                  )}
                  {activeTab === 'console' && (
                    <p className="text-sm text-gray-500">R$ 6,00/hora + R$ 3,00 por controle extra - Xbox ou Switch</p>
                  )}
                  {activeTab === 'arcade' && (
                    <p className="text-sm text-gray-500">R$ 5,00/hora - Fliperama</p>
                  )}
                </div>
              </div>

              {/* Grid de Dispositivos */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {activeTab === 'pc' && pcs.map(renderDeviceButton)}
                {activeTab === 'playstation' && playstations.map(renderDeviceButton)}
                {activeTab === 'console' && consoles.map(renderDeviceButton)}
                {activeTab === 'arcade' && arcades.map(renderDeviceButton)}

                {/* Mensagem se não houver dispositivos */}
                {activeTab === 'pc' && pcs.length === 0 && (
                  <p className="col-span-full text-center text-gray-400 py-8">
                    Nenhum PC disponível
                  </p>
                )}
                {activeTab === 'playstation' && playstations.length === 0 && (
                  <p className="col-span-full text-center text-gray-400 py-8">
                    Nenhum PlayStation disponível
                  </p>
                )}
                {activeTab === 'console' && consoles.length === 0 && (
                  <p className="col-span-full text-center text-gray-400 py-8">
                    Nenhum console disponível
                  </p>
                )}
                {activeTab === 'arcade' && arcades.length === 0 && (
                  <p className="col-span-full text-center text-gray-400 py-8">
                    Fliperama não disponível
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Produtos do Estoque */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Produtos
              {lowStockProducts.length > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  {lowStockProducts.length} com estoque baixo
                </span>
              )}
            </h2>
            
            {/* Busca por Código de Barras */}
            <form onSubmit={handleBarcodeSearch} className="mb-4">
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  className="w-full pl-10 pr-24 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Escaneie o código de barras..."
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  Buscar
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.filter(p => p.quantity > 0).map(product => (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product.id)}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-purple-50 hover:border-purple-200 border border-gray-200 transition-colors text-left"
                >
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  {product.barcode && (
                    <p className="text-xs text-gray-400 truncate">{product.barcode}</p>
                  )}
                  <p className="text-purple-600 font-bold">R$ {product.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Estoque: {product.quantity}</p>
                </button>
              ))}
              {products.filter(p => p.quantity > 0).length === 0 && (
                <p className="col-span-full text-center text-gray-500 py-8">
                  Nenhum produto disponível
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Carrinho */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-col">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-purple-600" />
            Carrinho ({cart.length})
          </h2>

          <div className="flex-1 overflow-auto mb-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-purple-600 font-bold">
                    R$ {item.totalPrice.toFixed(2)}
                  </p>
                </div>
                {item.type === 'product' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (item.quantity > 1) {
                          updateCartItem(item.id, {
                            quantity: item.quantity - 1,
                            totalPrice: (item.quantity - 1) * item.unitPrice,
                          });
                        } else {
                          removeFromCart(item.id);
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => {
                        updateCartItem(item.id, {
                          quantity: item.quantity + 1,
                          totalPrice: (item.quantity + 1) * item.unitPrice,
                        });
                      }}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                Carrinho vazio
              </p>
            )}
          </div>

          {/* Total e Finalizar */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600">Total:</span>
              <span className="text-2xl font-bold text-purple-600">
                R$ {total.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowPayment(true)}
                disabled={cart.length === 0}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                Finalizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tempo */}
      {showTimeModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              Adicionar Tempo - {devices.find(d => d.id === selectedDevice)?.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Cliente (opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedCustomerId(null);
                      setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    placeholder="Nome do cliente (ou busque cadastrado...)"
                  />
                  {showCustomerSuggestions && customerName && (
                    <div className="absolute z-[60] left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-auto">
                      {customers
                        .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                        .map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              setCustomerName(customer.name);
                              setSelectedCustomerId(customer.id);
                              setShowCustomerSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b last:border-0 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-gray-800">{customer.name}</p>
                              {customer.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-purple-600">{customer.credits} min</p>
                              <p className="text-[10px] text-gray-400">Saldo</p>
                            </div>
                          </button>
                        ))}
                      {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">
                          Nenhum cliente cadastrado encontrado...
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCustomerId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      <CheckCircle className="w-3 h-3" /> CADASTRADO
                    </div>
                  )}
                </div>
              </div>

              {/* Seleção de tipo de console (para consoles compartilhados) */}
              {devices.find(d => d.id === selectedDevice)?.type === 'console' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Console
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedConsoleType('xbox')}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                        selectedConsoleType === 'xbox'
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Gamepad2 className="w-8 h-8" />
                      <span className="font-medium">Xbox</span>
                    </button>
                    <button
                      onClick={() => setSelectedConsoleType('switch')}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                        selectedConsoleType === 'switch'
                          ? 'border-red-600 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Joystick className="w-8 h-8" />
                      <span className="font-medium">Nintendo Switch</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tempo (horas)
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setHours(Math.max(0.5, hours - 0.5))}
                    className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold w-16 text-center">{hours}h</span>
                  <button
                    onClick={() => setHours(hours + 0.5)}
                    className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(devices.find(d => d.id === selectedDevice)?.type === 'console' || 
                devices.find(d => d.id === selectedDevice)?.type === 'playstation') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Controles Extras (R$ 3,00 cada)
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExtraControllers(Math.max(0, extraControllers - 1))}
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-2xl font-bold w-16 text-center">{extraControllers}</span>
                    <button
                      onClick={() => setExtraControllers(extraControllers + 1)}
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total do tempo:</p>
                <p className="text-2xl font-bold text-purple-600">
                  R$ {(() => {
                    const device = devices.find(d => d.id === selectedDevice);
                    if (!device) return '0.00';
                    const pricePerHour = device.pricePerHour;
                    const extraPrice = (device.type === 'console' || device.type === 'playstation') 
                      ? extraControllers * 3 
                      : 0;
                    return ((pricePerHour * hours) + extraPrice).toFixed(2);
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {hours}h × R$ {devices.find(d => d.id === selectedDevice)?.pricePerHour.toFixed(2)}
                  {extraControllers > 0 && ` + ${extraControllers} × R$ 3,00`}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTimeModal(false);
                  setSelectedDevice(null);
                  setSelectedConsoleType(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddTimeToCart}
                disabled={
                  devices.find(d => d.id === selectedDevice)?.type === 'console' && 
                  !selectedConsoleType
                }
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pagamento */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Finalizar Venda</h3>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Total da venda:</p>
              <p className="text-3xl font-bold text-purple-600">
                R$ {total.toFixed(2)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                    paymentMethod === 'cash'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Banknote className="w-6 h-6" />
                  <span className="text-sm">Dinheiro</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                    paymentMethod === 'pix'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Smartphone className="w-6 h-6" />
                  <span className="text-sm">PIX</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                    paymentMethod === 'card'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="text-sm">Cartão</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('installment')}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                    paymentMethod === 'installment'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-6 h-6 text-indigo-600" />
                  <span className="text-sm">Carnê/OS</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'installment' && (
              <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                   <span>💰</span> Entrada / Adiantamento
                </label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-indigo-700">Valor</label>
                    <input
                      type="number"
                      value={downPayment.amount}
                      onChange={(e) => setDownPayment(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-indigo-700">Forma</label>
                    <select
                      value={downPayment.method}
                      onChange={(e) => setDownPayment(prev => ({ ...prev, method: e.target.value as any }))}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="card">Cartão</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-600">O valor da entrada será subtraído do total e registrado no caixa hoje.</p>
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Recebido
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-lg"
                  placeholder="0.00"
                />
                {change >= 0 && cashReceived && (
                  <div className="mt-3 bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Troco:</p>
                    <p className="text-xl font-bold text-green-600">
                      R$ {change.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPayment(false);
                  setCashReceived('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinishSale}
                disabled={paymentMethod === 'cash' && Number(cashReceived) < total}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {showCloseCash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Fechar Caixa</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor Inicial:</span>
                <span className="font-medium">R$ {cashRegister.initialAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total de Vendas:</span>
                <span className="font-medium text-green-600">R$ {cashRegister.totalSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Entradas:</span>
                <span className="font-medium text-blue-600">R$ {cashRegister.totalEntries.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Saídas:</span>
                <span className="font-medium text-red-600">R$ {cashRegister.totalExits.toFixed(2)}</span>
              </div>
              <hr />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Saldo Final:</span>
                <span className="font-bold text-purple-600">R$ {cashRegister.currentAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseCash(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseCash}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Fechar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sangria */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Sangria (Retirada)</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo
                </label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Motivo da retirada"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdraw(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || !withdrawReason}
                className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sucesso */}
      {showSuccessModal && lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Venda Concluída!</h3>
            <p className="text-gray-500 mb-6">A venda foi registrada com sucesso no sistema.</p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Total:</span>
                <span className="font-bold">R$ {lastSale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pagamento:</span>
                <span className="font-medium">{lastSale.paymentMethod.toUpperCase()}</span>
              </div>
              {lastSale.change > 0 && (
                <div className="flex justify-between text-sm mt-1 text-green-600 font-bold">
                  <span>Troco:</span>
                  <span>R$ {lastSale.change.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => generateReceiptPDF(lastSale, settings, 'print')}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 flex items-center justify-center gap-2 shadow-lg shadow-purple-100 transition-all active:scale-95"
              >
                <Printer className="w-5 h-5" />
                Imprimir Recibo
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setLastSale(null);
                }}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
              >
                Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
