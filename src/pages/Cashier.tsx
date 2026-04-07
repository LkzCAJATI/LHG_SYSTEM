import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Device, CartItem, CashBills } from '../types';
import toast from 'react-hot-toast';

export default function Cashier() {
  const { 
    devices, 
    products, 
    cashRegister, 
    addSale, 
    openCashRegister,
  } = useStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'pix' | 'card' | null>(null);
  const [quickTimeDevice, setQuickTimeDevice] = useState<Device | null>(null);
  const [quickTimeHours, setQuickTimeHours] = useState(1);
  const [quickTimeControls, setQuickTimeControls] = useState(0);
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'pc' | 'playstation' | 'console' | 'arcade'>('pc');
  const [openBills, setOpenBills] = useState<CashBills>({ 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 });
  const [selectedConsoleType, setSelectedConsoleType] = useState<'xbox' | 'switch' | null>(null);
  const [searchProduct, setSearchProduct] = useState('');

  const billValues: (keyof CashBills)[] = [2, 5, 10, 20, 50, 100];

  // Calcular total do carrinho
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calcular troco
  const troco = selectedPayment === 'cash' && valorRecebido 
    ? parseFloat(valorRecebido) - cartTotal 
    : 0;

  // Função para calcular cédulas ideais para o troco
  const calcularCedulasTroco = (valorTroco: number): { cedula: number; quantidade: number }[] => {
    if (valorTroco <= 0 || !cashRegister || cashRegister.status !== 'open') return [];
    
    const resultado: { cedula: number; quantidade: number }[] = [];
    let restante = Math.round(valorTroco * 100) / 100;
    
    // Ordenar cédulas da maior para menor
    const cedulasDisponiveis = billValues
      .map(valor => ({ valor, quantidade: cashRegister.bills[valor] || 0 }))
      .filter(c => c.quantidade > 0)
      .sort((a, b) => b.valor - a.valor);
    
    for (const cedula of cedulasDisponiveis) {
      if (restante <= 0) break;
      
      const notasNecessarias = Math.min(
        Math.floor(restante / cedula.valor),
        cedula.quantidade
      );
      
      if (notasNecessarias > 0) {
        resultado.push({ cedula: cedula.valor, quantidade: notasNecessarias });
        restante = Math.round((restante - notasNecessarias * cedula.valor) * 100) / 100;
      }
    }
    
    return resultado;
  };

  const cedulasTroco = troco > 0 ? calcularCedulasTroco(troco) : [];
  const trocoDisponivel = cashRegister ? billValues.reduce((sum, value) => 
    sum + (cashRegister.bills[value] || 0) * value, 0) : 0;
  const podeDarTroco = troco <= 0 || (troco > 0 && cedulasTroco.reduce((sum, c) => sum + c.quantidade * c.cedula, 0) >= troco);

  // Dispositivos por categoria
  const pcDevices = devices.filter(d => d.type === 'pc');
  const playstationDevices = devices.filter(d => d.type === 'playstation');
  const consoleDevices = devices.filter(d => d.type === 'console');
  const arcadeDevices = devices.filter(d => d.type === 'arcade');

  // Produtos filtrados
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const getDevicePrice = (device: Device): number => {
    return device.pricePerHour || 5;
  };

  const addTimeToCart = (device: Device) => {
    if (device.type === 'console') {
      setQuickTimeDevice(device);
      setSelectedConsoleType(null);
      setQuickTimeHours(1);
      setQuickTimeControls(0);
      return;
    }
    setQuickTimeDevice(device);
    setQuickTimeHours(1);
    setQuickTimeControls(0);
  };

  const confirmAddTime = () => {
    if (!quickTimeDevice) return;
    
    const pricePerHour = getDevicePrice(quickTimeDevice);
    const controlPrice = 3;
    const timeTotal = quickTimeHours * pricePerHour;
    const controlsTotal = quickTimeControls * controlPrice;
    const total = timeTotal + controlsTotal;

    let itemName = quickTimeDevice.name;
    if (selectedConsoleType) {
      itemName += ` (${selectedConsoleType === 'xbox' ? 'Xbox' : 'Nintendo Switch'})`;
    }

    const newItem: CartItem = {
      id: `${quickTimeDevice.id}-${Date.now()}`,
      type: 'time',
      deviceId: quickTimeDevice.id,
      name: itemName,
      quantity: quickTimeHours,
      unitPrice: pricePerHour,
      totalPrice: total,
      duration: quickTimeHours * 60,
      extraControllers: quickTimeControls
    };

    setCart([...cart, newItem]);
    setQuickTimeDevice(null);
    setQuickTimeHours(1);
    setQuickTimeControls(0);
    setSelectedConsoleType(null);
    toast.success(`${itemName} adicionado ao carrinho`);
  };

  const addProductToCart = (product: typeof products[0]) => {
    const existingIndex = cart.findIndex(item => 
      item.type === 'product' && item.productId === product.id
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].totalPrice = newCart[existingIndex].quantity * newCart[existingIndex].unitPrice;
      setCart(newCart);
    } else {
      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        type: 'product',
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price
      };
      setCart([...cart, newItem]);
    }
    toast.success(`${product.name} adicionado`);
    setSearchProduct('');
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(cart.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity,
          totalPrice: item.type === 'product' ? quantity * item.unitPrice : item.totalPrice
        };
      }
      return item;
    }));
  };

  const finalizeSale = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }
    if (!selectedPayment) {
      toast.error('Selecione a forma de pagamento');
      return;
    }
    if (!cashRegister || cashRegister.status !== 'open') {
      toast.error('Caixa está fechado!');
      return;
    }
    if (selectedPayment === 'cash' && !valorRecebido) {
      toast.error('Informe o valor recebido');
      return;
    }
    if (selectedPayment === 'cash' && parseFloat(valorRecebido) < cartTotal) {
      toast.error('Valor recebido é menor que o total');
      return;
    }
    if (selectedPayment === 'cash' && troco > 0 && !podeDarTroco) {
      toast.error('Não há cédulas suficientes no caixa para dar o troco!');
      return;
    }

    // Criar venda
    const sale = {
      id: `VND-${Date.now()}`,
      items: cart,
      subtotal: cartTotal,
      discount: 0,
      total: cartTotal,
      paymentMethod: selectedPayment,
      cashReceived: selectedPayment === 'cash' ? parseFloat(valorRecebido) : undefined,
      change: troco > 0 ? troco : undefined,
      userId: 'current-user',
      userName: 'Admin',
      createdAt: new Date()
    };

    addSale(sale);

    // Limpar
    setCart([]);
    setSelectedPayment(null);
    setValorRecebido('');
    toast.success('Venda finalizada com sucesso!');
  };

  const handleOpenCashRegister = () => {
    const total = billValues.reduce((sum, value) => sum + (openBills[value] || 0) * value, 0);
    if (total < 50) {
      toast.error('Valor mínimo para abertura: R$ 50,00');
      return;
    }
    openCashRegister(openBills);
    toast.success('Caixa aberto com sucesso!');
  };

  // Tela de abertura do caixa
  if (!cashRegister || cashRegister.status !== 'open') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">💰</div>
          <h2 className="text-2xl font-bold text-white mb-2">Caixa Fechado</h2>
          <p className="text-gray-400 mb-6">Abra o caixa para iniciar as vendas</p>
          
          <div className="bg-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-white font-semibold mb-3">Informar Cédulas Iniciais</h3>
            <div className="grid grid-cols-3 gap-3">
              {billValues.map(value => (
                <div key={value} className="bg-gray-600 rounded-lg p-3">
                  <div className="text-green-400 font-bold">R$ {value}</div>
                  <input
                    type="number"
                    min="0"
                    value={openBills[value] || 0}
                    onChange={(e) => setOpenBills({...openBills, [value]: parseInt(e.target.value) || 0})}
                    className="w-full mt-2 bg-gray-800 text-white text-center rounded px-2 py-1"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="text-gray-400">Total Inicial:</div>
              <div className="text-2xl font-bold text-green-400">
                R$ {billValues.reduce((sum, v) => sum + (openBills[v] || 0) * v, 0).toFixed(2)}
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenCashRegister}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-lg transition"
          >
            Abrir Caixa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Coluna Esquerda - Dispositivos e Produtos */}
      <div className="flex-1 flex flex-col">
        {/* Tabs de Dispositivos */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSelectedCategory('pc')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedCategory === 'pc' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🖥️ PCs ({pcDevices.length})
          </button>
          <button
            onClick={() => setSelectedCategory('playstation')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedCategory === 'playstation' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🎮 PlayStation ({playstationDevices.length})
          </button>
          <button
            onClick={() => setSelectedCategory('console')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedCategory === 'console' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🕹️ Consoles ({consoleDevices.length})
          </button>
          <button
            onClick={() => setSelectedCategory('arcade')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedCategory === 'arcade' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ⚡ Fliperama ({arcadeDevices.length})
          </button>
        </div>

        {/* Grid de Dispositivos */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {selectedCategory === 'pc' && pcDevices.map(device => (
            <button
              key={device.id}
              onClick={() => addTimeToCart(device)}
              disabled={device.status === 'in_use'}
              className={`p-4 rounded-xl text-center transition ${
                device.status === 'in_use'
                  ? 'bg-red-900/50 border-2 border-red-600 cursor-not-allowed'
                  : device.status === 'maintenance'
                  ? 'bg-yellow-900/50 border-2 border-yellow-600 hover:bg-yellow-800'
                  : 'bg-gray-700 border-2 border-gray-600 hover:border-purple-500 hover:bg-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">🖥️</div>
              <div className="text-white font-semibold">{device.name}</div>
              <div className={`text-xs mt-1 ${
                device.status === 'in_use' ? 'text-red-400' :
                device.status === 'maintenance' ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {device.status === 'in_use' ? 'Em Uso' :
                 device.status === 'maintenance' ? 'Manutenção' : 'Livre'}
              </div>
              <div className="text-gray-400 text-xs mt-1">R$ {(device.pricePerHour || 5).toFixed(2)}/h</div>
            </button>
          ))}

          {selectedCategory === 'playstation' && playstationDevices.map(device => (
            <button
              key={device.id}
              onClick={() => addTimeToCart(device)}
              disabled={device.status === 'in_use'}
              className={`p-4 rounded-xl text-center transition ${
                device.status === 'in_use'
                  ? 'bg-red-900/50 border-2 border-red-600 cursor-not-allowed'
                  : 'bg-gray-700 border-2 border-gray-600 hover:border-purple-500 hover:bg-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">🎮</div>
              <div className="text-white font-semibold">{device.name}</div>
              <div className="text-gray-400 text-xs mt-1">R$ {(device.pricePerHour || 6).toFixed(2)}/h</div>
              <div className="text-gray-500 text-xs">+R$ 3,00/controle</div>
            </button>
          ))}

          {selectedCategory === 'console' && consoleDevices.map(device => (
            <button
              key={device.id}
              onClick={() => addTimeToCart(device)}
              disabled={device.status === 'in_use'}
              className={`p-4 rounded-xl text-center transition ${
                device.status === 'in_use'
                  ? 'bg-red-900/50 border-2 border-red-600 cursor-not-allowed'
                  : 'bg-gray-700 border-2 border-gray-600 hover:border-purple-500 hover:bg-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">🕹️</div>
              <div className="text-white font-semibold">{device.name}</div>
              <div className="text-gray-400 text-xs mt-1">R$ {(device.pricePerHour || 6).toFixed(2)}/h</div>
              <div className="text-gray-500 text-xs">+R$ 3,00/controle</div>
            </button>
          ))}

          {selectedCategory === 'arcade' && arcadeDevices.map(device => (
            <button
              key={device.id}
              onClick={() => addTimeToCart(device)}
              disabled={device.status === 'in_use'}
              className={`p-4 rounded-xl text-center transition ${
                device.status === 'in_use'
                  ? 'bg-red-900/50 border-2 border-red-600 cursor-not-allowed'
                  : 'bg-gray-700 border-2 border-gray-600 hover:border-purple-500 hover:bg-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-white font-semibold">{device.name}</div>
              <div className="text-gray-400 text-xs mt-1">R$ {(device.pricePerHour || 5).toFixed(2)}/h</div>
            </button>
          ))}
        </div>

        {/* Busca de Produtos */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">📦 Produtos (Código de Barras ou Nome)</h3>
          <input
            type="text"
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder="Digite o código de barras ou nome do produto..."
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 mb-3 focus:ring-2 focus:ring-purple-500 outline-none"
            autoFocus
          />
          
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addProductToCart(product)}
                disabled={product.quantity <= 0}
                className={`p-3 rounded-lg text-left transition ${
                  product.quantity <= 0
                    ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="text-white font-medium truncate">{product.name}</div>
                <div className="text-gray-400 text-xs">{product.category}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-green-400 font-semibold">R$ {product.price.toFixed(2)}</span>
                  <span className="text-gray-500 text-xs">Est: {product.quantity}</span>
                </div>
                {product.barcode && (
                  <div className="text-gray-500 text-xs mt-1">📦 {product.barcode}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coluna Direita - Carrinho e Pagamento */}
      <div className="w-96 flex flex-col gap-4">
        {/* Carrinho */}
        <div className="bg-gray-800 rounded-xl p-4 flex-1 overflow-hidden flex flex-col">
          <h3 className="text-white font-semibold mb-3">🛒 Carrinho</h3>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Carrinho vazio
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">
                        {item.name}
                      </div>
                      {item.type === 'time' ? (
                        <div className="text-gray-400 text-xs">
                          {item.quantity}h × R$ {item.unitPrice.toFixed(2)}
                          {item.extraControllers ? ` + ${item.extraControllers} controle(s)` : ''}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            className="w-6 h-6 bg-gray-600 rounded text-white text-sm hover:bg-gray-500"
                          >-</button>
                          <span className="text-gray-300 text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 bg-gray-600 rounded text-white text-sm hover:bg-gray-500"
                          >+</button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-semibold">R$ {item.totalPrice.toFixed(2)}</div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-400 text-xs hover:text-red-300"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">💳 Pagamento</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => { setSelectedPayment('cash'); setValorRecebido(''); }}
              className={`p-3 rounded-lg font-medium transition ${
                selectedPayment === 'cash'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              💵 Dinheiro
            </button>
            <button
              onClick={() => { setSelectedPayment('pix'); setValorRecebido(''); }}
              className={`p-3 rounded-lg font-medium transition ${
                selectedPayment === 'pix'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📱 PIX
            </button>
            <button
              onClick={() => { setSelectedPayment('card'); setValorRecebido(''); }}
              className={`p-3 rounded-lg font-medium transition ${
                selectedPayment === 'card'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              💳 Cartão
            </button>
          </div>

          {/* Campo Valor Recebido (Dinheiro) */}
          {selectedPayment === 'cash' && (
            <div className="mb-4 bg-gray-700 rounded-lg p-4">
              <label className="text-gray-300 text-sm block mb-2">Valor Recebido:</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 text-white text-2xl font-bold rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              
              {/* Sugestões de valores */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {cartTotal > 0 && (
                  <>
                    <button
                      onClick={() => setValorRecebido(cartTotal.toFixed(2))}
                      className="px-3 py-1 bg-gray-600 rounded text-sm text-white hover:bg-gray-500"
                    >
                      Valor exato
                    </button>
                    {billValues.filter(v => v >= cartTotal).map(value => (
                      <button
                        key={value}
                        onClick={() => setValorRecebido(value.toFixed(2))}
                        className="px-3 py-1 bg-gray-600 rounded text-sm text-white hover:bg-gray-500"
                      >
                        R$ {value}
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Troco */}
              {valorRecebido && parseFloat(valorRecebido) > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-white font-semibold">R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Recebido:</span>
                    <span className="text-white font-semibold">R$ {parseFloat(valorRecebido).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Troco:</span>
                    <span className={`text-2xl font-bold ${troco > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      R$ {troco > 0 ? troco.toFixed(2) : '0.00'}
                    </span>
                  </div>

                  {/* Sugestão de cédulas para o troco */}
                  {troco > 0 && (
                    <div className="mt-3 bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-sm mb-2">💡 Sugestão de cédulas:</div>
                      {podeDarTroco ? (
                        <div className="flex flex-wrap gap-2">
                          {cedulasTroco.map((c, idx) => (
                            <div key={idx} className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-sm">
                              {c.quantidade}× R$ {c.cedula}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-red-400 text-sm">
                          ⚠️ Sem cédulas suficientes! Disponível: R$ {trocoDisponivel.toFixed(2)}
                        </div>
                      )}
                      
                      {/* Cédulas disponíveis no caixa */}
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="text-gray-500 text-xs mb-1">Cédulas no caixa:</div>
                        <div className="flex flex-wrap gap-1">
                          {billValues.map(value => {
                            const qty = cashRegister?.bills[value] || 0;
                            return qty > 0 ? (
                              <span key={value} className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                                {qty}× R${value}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-lg">TOTAL:</span>
              <span className="text-3xl font-bold text-green-400">R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Botão Finalizar */}
          <button
            onClick={finalizeSale}
            disabled={
              cart.length === 0 || 
              !selectedPayment || 
              (selectedPayment === 'cash' && (!valorRecebido || parseFloat(valorRecebido) < cartTotal)) ||
              (selectedPayment === 'cash' && troco > 0 && !podeDarTroco)
            }
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              cart.length === 0 || !selectedPayment || (selectedPayment === 'cash' && (!valorRecebido || parseFloat(valorRecebido) < cartTotal))
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            ✅ Finalizar Venda
          </button>
        </div>
      </div>

      {/* Modal Selecionar Console */}
      {quickTimeDevice && quickTimeDevice.type === 'console' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Selecionar Console</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => setSelectedConsoleType('xbox')}
                className={`p-6 rounded-xl text-center transition ${
                  selectedConsoleType === 'xbox'
                    ? 'bg-green-600 border-2 border-green-400'
                    : 'bg-gray-700 border-2 border-gray-600 hover:border-green-500'
                }`}
              >
                <div className="text-4xl mb-2">🎮</div>
                <div className="text-white font-semibold">Xbox</div>
              </button>
              <button
                onClick={() => setSelectedConsoleType('switch')}
                className={`p-6 rounded-xl text-center transition ${
                  selectedConsoleType === 'switch'
                    ? 'bg-red-600 border-2 border-red-400'
                    : 'bg-gray-700 border-2 border-gray-600 hover:border-red-500'
                }`}
              >
                <div className="text-4xl mb-2">🕹️</div>
                <div className="text-white font-semibold">Nintendo Switch</div>
              </button>
            </div>

            {selectedConsoleType && (
              <>
                <div className="mb-4">
                  <label className="text-gray-300 text-sm block mb-2">Horas:</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(h => (
                      <button
                        key={h}
                        onClick={() => setQuickTimeHours(h)}
                        className={`flex-1 py-3 rounded-lg font-bold transition ${
                          quickTimeHours === h
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-gray-300 text-sm block mb-2">Controles Extras (R$ 3,00 cada):</label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(c => (
                      <button
                        key={c}
                        onClick={() => setQuickTimeControls(c)}
                        className={`flex-1 py-3 rounded-lg font-bold transition ${
                          quickTimeControls === c
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="flex justify-between text-gray-300">
                    <span>Tempo ({quickTimeHours}h × R$ 6,00):</span>
                    <span>R$ {(quickTimeHours * 6).toFixed(2)}</span>
                  </div>
                  {quickTimeControls > 0 && (
                    <div className="flex justify-between text-gray-300 mt-2">
                      <span>Controles ({quickTimeControls} × R$ 3,00):</span>
                      <span>R$ {(quickTimeControls * 3).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-bold mt-2 pt-2 border-t border-gray-600">
                    <span>Total:</span>
                    <span className="text-green-400">R$ {(quickTimeHours * 6 + quickTimeControls * 3).toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setQuickTimeDevice(null); setSelectedConsoleType(null); }}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-xl font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddTime}
                disabled={!selectedConsoleType}
                className={`flex-1 py-3 rounded-xl font-bold transition ${
                  selectedConsoleType
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tempo PC/Playstation/Arcade */}
      {quickTimeDevice && quickTimeDevice.type !== 'console' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              {quickTimeDevice.name} - R$ {(quickTimeDevice.pricePerHour || 5).toFixed(2)}/hora
            </h3>

            <div className="mb-4">
              <label className="text-gray-300 text-sm block mb-2">Horas:</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(h => (
                  <button
                    key={h}
                    onClick={() => setQuickTimeHours(h)}
                    className={`flex-1 py-3 rounded-lg font-bold transition ${
                      quickTimeHours === h
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {(quickTimeDevice.type === 'playstation') && (
              <div className="mb-4">
                <label className="text-gray-300 text-sm block mb-2">Controles Extras (R$ 3,00 cada):</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map(c => (
                    <button
                      key={c}
                      onClick={() => setQuickTimeControls(c)}
                      className={`flex-1 py-3 rounded-lg font-bold transition ${
                        quickTimeControls === c
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-gray-300">
                <span>Tempo ({quickTimeHours}h × R$ {(quickTimeDevice.pricePerHour || 5).toFixed(2)}):</span>
                <span>R$ {(quickTimeHours * (quickTimeDevice.pricePerHour || 5)).toFixed(2)}</span>
              </div>
              {quickTimeControls > 0 && (
                <div className="flex justify-between text-gray-300 mt-2">
                  <span>Controles ({quickTimeControls} × R$ 3,00):</span>
                  <span>R$ {(quickTimeControls * 3).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold mt-2 pt-2 border-t border-gray-600">
                <span>Total:</span>
                <span className="text-green-400">
                  R$ {(quickTimeHours * (quickTimeDevice.pricePerHour || 5) + quickTimeControls * 3).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setQuickTimeDevice(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-xl font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddTime}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
