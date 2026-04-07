import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User, Device, Session, Product, Sale, Customer, Budget,
  CashRegister, CashBills, CashMovement, StockMovement, CartItem, DEFAULT_PRICES
} from '../types';

interface AppState {
  // Auth
  currentUser: User | null;
  users: User[];
  
  // Devices & Sessions
  devices: Device[];
  sessions: Session[];
  
  // Products & Stock
  products: Product[];
  stockMovements: StockMovement[];
  
  // Sales
  sales: Sale[];
  cart: CartItem[];
  
  // Customers
  customers: Customer[];
  
  // Budgets
  budgets: Budget[];
  
  // Cash Register
  cashRegister: CashRegister | null;
  cashHistory: CashRegister[];
  
  // UI
  currentPage: string;
  
  // Auth Actions
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // Device Actions
  addDevice: (device: Omit<Device, 'id'>) => void;
  updateDevice: (id: string, device: Partial<Device>) => void;
  deleteDevice: (id: string) => void;
  startSession: (deviceId: string, customerName: string, duration: number, extraControllers: number, customerId?: string) => void;
  endSession: (sessionId: string) => void;
  endSessionSavingTime: (sessionId: string) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  
  // Product Actions
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, quantity: number, type: 'entry' | 'sale' | 'adjustment') => void;
  
  // Cart Actions
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateCartItem: (id: string, item: Partial<CartItem>) => void;
  clearCart: () => void;
  
  // Sale Actions
  createSale: (paymentMethod: Sale['paymentMethod'], cashReceived?: number) => Sale | null;
  addSale: (sale: Sale) => void;
  
  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalSpent' | 'visits'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCredits: (customerId: string, minutes: number) => void;
  removeCredits: (customerId: string, minutes: number) => void;
  
  // Budget Actions
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  convertBudgetToSale: (budgetId: string) => void;
  
  // Cash Register Actions
  openCashRegister: (bills: CashBills) => void;
  closeCashRegister: () => void;
  addCashMovement: (movement: Omit<CashMovement, 'id' | 'createdAt' | 'userId' | 'userName'>) => void;
  
  // UI Actions
  setCurrentPage: (page: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Inicializar dispositivos padrão
const defaultDevices: Device[] = [
  // PCs (PC 01 a PC 10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `pc-${i + 1}`,
    name: `PC ${String(i + 1).padStart(2, '0')}`,
    type: 'pc' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.pc,
  })),
  // PlayStation 5 (PS5 A a PS5 F)
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `ps5-${i + 1}`,
    name: `PS5 ${String.fromCharCode(65 + i)}`,
    type: 'playstation' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.playstation,
    consoleType: 'playstation' as const,
    extraControllers: 0,
  })),
  // Consoles compartilhados
  {
    id: 'console-g',
    name: 'Console G',
    type: 'console' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.other_console,
    consoleType: 'other' as const,
    extraControllers: 0,
  },
  {
    id: 'console-h',
    name: 'Console H',
    type: 'console' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.other_console,
    consoleType: 'other' as const,
    extraControllers: 0,
  },
  // Fliperama
  {
    id: 'arcade-1',
    name: 'Fliperama',
    type: 'arcade' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.arcade,
  },
];

// Usuário admin padrão
const defaultUsers: User[] = [
  {
    id: '1',
    name: 'Administrador',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    createdAt: new Date(),
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentUser: null,
      users: defaultUsers,
      devices: defaultDevices,
      sessions: [],
      products: [],
      stockMovements: [],
      sales: [],
      cart: [],
      customers: [],
      budgets: [],
      cashRegister: null,
      cashHistory: [],
      currentPage: 'cashier',

      // Auth Actions
      login: (username, password) => {
        const user = get().users.find(u => u.username === username && u.password === password);
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      addUser: (userData) => {
        const user: User = {
          ...userData,
          id: generateId(),
          createdAt: new Date(),
        };
        set(state => ({ users: [...state.users, user] }));
      },

      updateUser: (id, userData) => {
        set(state => ({
          users: state.users.map(u => u.id === id ? { ...u, ...userData } : u),
        }));
      },

      deleteUser: (id) => {
        set(state => ({
          users: state.users.filter(u => u.id !== id),
        }));
      },

      // Device Actions
      addDevice: (deviceData) => {
        const device: Device = {
          ...deviceData,
          id: generateId(),
        };
        set(state => ({ devices: [...state.devices, device] }));
      },

      updateDevice: (id, deviceData) => {
        set(state => ({
          devices: state.devices.map(d => d.id === id ? { ...d, ...deviceData } : d),
        }));
      },

      deleteDevice: (id) => {
        set(state => ({
          devices: state.devices.filter(d => d.id !== id),
        }));
      },

      startSession: (deviceId, customerName, duration, extraControllers, customerId) => {
        const device = get().devices.find(d => d.id === deviceId);
        if (!device) return;

        // Calcular preço
        let pricePerHour = device.pricePerHour;
        let extraPrice = 0;
        
        if (device.type === 'console' && extraControllers > 0) {
          extraPrice = extraControllers * DEFAULT_PRICES.extraController * duration;
        }

        const totalPrice = (pricePerHour * duration) + extraPrice;

        const session: Session = {
          id: generateId(),
          deviceId,
          deviceName: device.name,
          customerId: customerId ?? undefined,
          customerName,
          startTime: new Date(),
          duration: duration * 60, // converter para minutos
          extraControllers,
          totalPrice,
          paid: false,
        };

        set(state => ({
          sessions: [...state.sessions, session],
          devices: state.devices.map(d =>
            d.id === deviceId
              ? { ...d, status: 'in_use' as const, currentSession: session }
              : d
          ),
        }));
      },

      endSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;

        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, endTime: new Date(), paid: true } : s
          ),
          devices: state.devices.map(d =>
            d.id === session.deviceId
              ? { ...d, status: 'available' as const, currentSession: undefined }
              : d
          ),
        }));
      },

      // Encerra a sessão e, se o cliente tiver cadastro, salva o tempo restante como créditos
      endSessionSavingTime: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;

        const now = session.isPaused && session.pausedAt ? new Date(session.pausedAt).getTime() : new Date().getTime();
        const diff = now - new Date(session.startTime).getTime();
        const effectiveElapsedMs = Math.max(0, diff - (session.totalPausedTime || 0));
        const elapsedSeconds = Math.floor(effectiveElapsedMs / 1000);

        // Sessão tem duração em MINUTOS no store, elapsedSeconds é o tempo já usado em segundos
        const totalSeconds = session.duration * 60;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        const remainingMinutes = Math.floor(remainingSeconds / 60);

        // Finaliza a sessão
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, endTime: new Date(), paid: true, isPaused: false } : s
          ),
          devices: state.devices.map(d =>
            d.id === session.deviceId
              ? { ...d, status: 'available' as const, currentSession: undefined }
              : d
          ),
        }));

        // Se tem cliente cadastrado e sobrou tempo, credita os minutos restantes
        if (session.customerId && remainingMinutes > 0) {
          get().addCredits(session.customerId, remainingMinutes);
        }
      },

      pauseSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session || session.isPaused) return;

        const updatedSession = { ...session, isPaused: true, pausedAt: new Date() };

        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? updatedSession : s),
          devices: state.devices.map(d =>
            d.id === session.deviceId ? { ...d, status: 'paused' as const, currentSession: updatedSession } : d
          )
        }));
      },

      resumeSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session || !session.isPaused || !session.pausedAt) return;

        const pausedDurationMs = new Date().getTime() - new Date(session.pausedAt).getTime();
        const totalPausedTimeMs = (session.totalPausedTime || 0) + pausedDurationMs;

        const updatedSession = { 
          ...session, 
          isPaused: false, 
          pausedAt: undefined, 
          totalPausedTime: totalPausedTimeMs 
        };

        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? updatedSession : s),
          devices: state.devices.map(d =>
            d.id === session.deviceId ? { ...d, status: 'in_use' as const, currentSession: updatedSession } : d
          )
        }));
      },

      // Product Actions
      addProduct: (productData) => {
        const product: Product = {
          ...productData,
          id: generateId(),
        };
        set(state => ({ products: [...state.products, product] }));
      },

      updateProduct: (id, productData) => {
        set(state => ({
          products: state.products.map(p => p.id === id ? { ...p, ...productData } : p),
        }));
      },

      deleteProduct: (id) => {
        set(state => ({
          products: state.products.filter(p => p.id !== id),
        }));
      },

      adjustStock: (productId, quantity, type) => {
        const product = get().products.find(p => p.id === productId);
        if (!product) return;

        const previousStock = product.quantity;
        const newStock = type === 'sale' ? previousStock - quantity : previousStock + quantity;

        const movement: StockMovement = {
          id: generateId(),
          productId,
          productName: product.name,
          type,
          quantity,
          previousStock,
          newStock,
          userId: get().currentUser?.id || '',
          userName: get().currentUser?.name || '',
          createdAt: new Date(),
        };

        set(state => ({
          products: state.products.map(p =>
            p.id === productId ? { ...p, quantity: newStock } : p
          ),
          stockMovements: [...state.stockMovements, movement],
        }));
      },

      // Cart Actions
      addToCart: (itemData) => {
        const item: CartItem = {
          ...itemData,
          id: generateId(),
        };
        set(state => ({ cart: [...state.cart, item] }));
      },

      removeFromCart: (id) => {
        set(state => ({ cart: state.cart.filter(item => item.id !== id) }));
      },

      updateCartItem: (id, itemData) => {
        set(state => ({
          cart: state.cart.map(item =>
            item.id === id ? { ...item, ...itemData } : item
          ),
        }));
      },

      clearCart: () => set({ cart: [] }),

      // Sale Actions
      createSale: (paymentMethod, cashReceived) => {
        const { cart, currentUser, cashRegister } = get();
        if (cart.length === 0 || !currentUser) return null;

        const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const total = subtotal;

        // Verificar troco se dinheiro
        let change = 0;
        if (paymentMethod === 'cash' && cashReceived) {
          change = cashReceived - total;
          if (change < 0) return null;
        }

        const sale: Sale = {
          id: generateId(),
          items: cart,
          subtotal,
          discount: 0,
          total,
          paymentMethod,
          cashReceived,
          change,
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: new Date(),
        };

        // Atualizar estoque dos produtos
        cart.forEach(item => {
          if (item.type === 'product' && item.productId) {
            get().adjustStock(item.productId, item.quantity, 'sale');
          }
          // Iniciar sessão se for tempo
          if (item.type === 'time' && item.deviceId) {
            const device = get().devices.find(d => d.id === item.deviceId);
            if (device && device.type === 'pc') {
              // Liberar PC via rede (simulado)
              get().updateDevice(item.deviceId, { status: 'in_use' });
            }
          }
        });

        // Adicionar ao caixa
        if (cashRegister && cashRegister.status === 'open') {
          const movement: CashMovement = {
            id: generateId(),
            type: 'sale',
            amount: total,
            description: `Venda #${sale.id}`,
            userId: currentUser.id,
            userName: currentUser.name,
            createdAt: new Date(),
          };

          set(state => ({
            cashRegister: state.cashRegister ? {
              ...state.cashRegister,
              currentAmount: state.cashRegister.currentAmount + total,
              totalSales: state.cashRegister.totalSales + total,
              movements: [...state.cashRegister.movements, movement],
            } : null,
          }));
        }

        set(state => ({
          sales: [...state.sales, sale],
          cart: [],
        }));

        return sale;
      },

      // Customer Actions
      addCustomer: (customerData) => {
        const customer: Customer = {
          ...customerData,
          id: generateId(),
          totalSpent: 0,
          visits: 0,
          createdAt: new Date(),
        };
        set(state => ({ customers: [...state.customers, customer] }));
      },

      updateCustomer: (id, customerData) => {
        set(state => ({
          customers: state.customers.map(c => c.id === id ? { ...c, ...customerData } : c),
        }));
      },

      deleteCustomer: (id) => {
        set(state => ({
          customers: state.customers.filter(c => c.id !== id),
        }));
      },

      addCredits: (customerId, minutes) => {
        set(state => ({
          customers: state.customers.map(c =>
            c.id === customerId
              ? { ...c, credits: c.credits + minutes }
              : c
          ),
        }));
      },

      removeCredits: (customerId, minutes) => {
        set(state => ({
          customers: state.customers.map(c =>
            c.id === customerId
              ? { ...c, credits: Math.max(0, c.credits - minutes) }
              : c
          ),
        }));
      },

      // Budget Actions
      addBudget: (budgetData) => {
        const budget: Budget = {
          ...budgetData,
          id: generateId(),
          createdAt: new Date(),
        };
        set(state => ({ budgets: [...state.budgets, budget] }));
      },

      updateBudget: (id, budgetData) => {
        set(state => ({
          budgets: state.budgets.map(b => b.id === id ? { ...b, ...budgetData } : b),
        }));
      },

      deleteBudget: (id) => {
        set(state => ({
          budgets: state.budgets.filter(b => b.id !== id),
        }));
      },

      convertBudgetToSale: (budgetId) => {
        const budget = get().budgets.find(b => b.id === budgetId);
        if (!budget) return;

        // Adicionar itens do orçamento ao carrinho
        budget.items.forEach(item => {
          get().addToCart({
            type: 'product',
            name: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          });
        });

        // Marcar orçamento como convertido
        set(state => ({
          budgets: state.budgets.map(b =>
            b.id === budgetId ? { ...b, status: 'converted' as const } : b
          ),
        }));
      },

      // Cash Register Actions
      openCashRegister: (bills) => {
        const total = Object.entries(bills).reduce((sum, [value, qty]) => {
          return sum + (Number(value) * qty);
        }, 0);

        const register: CashRegister = {
          id: generateId(),
          openedAt: new Date(),
          initialAmount: total,
          currentAmount: total,
          totalSales: 0,
          totalEntries: 0,
          totalExits: 0,
          status: 'open',
          bills,
          movements: [{
            id: generateId(),
            type: 'entry',
            amount: total,
            description: 'Abertura de caixa',
            userId: get().currentUser?.id || '',
            userName: get().currentUser?.name || '',
            createdAt: new Date(),
          }],
        };

        set({ cashRegister: register });
      },

      closeCashRegister: () => {
        const register = get().cashRegister;
        if (!register) return;

        const closedRegister: CashRegister = {
          ...register,
          closedAt: new Date(),
          status: 'closed',
        };

        set(state => ({
          cashRegister: null,
          cashHistory: [...state.cashHistory, closedRegister],
        }));
      },

      addCashMovement: (movementData) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        const movement: CashMovement = {
          ...movementData,
          id: generateId(),
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: new Date(),
        };

        set(state => {
          if (!state.cashRegister) return state;

          const amountChange = movementData.type === 'entry' ? movementData.amount : -movementData.amount;

          return {
            cashRegister: {
              ...state.cashRegister,
              currentAmount: state.cashRegister.currentAmount + amountChange,
              totalEntries: movementData.type === 'entry'
                ? state.cashRegister.totalEntries + movementData.amount
                : state.cashRegister.totalEntries,
              totalExits: movementData.type === 'exit'
                ? state.cashRegister.totalExits + movementData.amount
                : state.cashRegister.totalExits,
              movements: [...state.cashRegister.movements, movement],
            },
          };
        });
      },

      // Sale Actions
      addSale: (sale) => {
        set(state => ({ sales: [...state.sales, sale] }));
        
        // Atualizar estoque dos produtos
        sale.items.forEach(item => {
          if (item.type === 'product' && item.productId) {
            get().adjustStock(item.productId, item.quantity, 'sale');
          }
          // Iniciar sessão se for tempo
          if (item.type === 'time' && item.deviceId) {
            const device = get().devices.find(d => d.id === item.deviceId);
            if (device && device.type === 'pc') {
              get().updateDevice(item.deviceId, { status: 'in_use' });
            }
          }
        });

        // Adicionar ao caixa
        const cashRegister = get().cashRegister;
        if (cashRegister && cashRegister.status === 'open') {
          const currentUser = get().currentUser;
          const movement: CashMovement = {
            id: generateId(),
            type: 'sale',
            amount: sale.total,
            description: `Venda #${sale.id}`,
            userId: currentUser?.id || '',
            userName: currentUser?.name || '',
            createdAt: new Date(),
          };

          set(state => ({
            cashRegister: state.cashRegister ? {
              ...state.cashRegister,
              currentAmount: state.cashRegister.currentAmount + sale.total,
              totalSales: state.cashRegister.totalSales + sale.total,
              movements: [...state.cashRegister.movements, movement],
            } : null,
          }));
        }
      },

      // UI Actions
      setCurrentPage: (page) => set({ currentPage: page }),
    }),
    {
      name: 'lanhouse-storage',
      partialize: (state) => ({
        users: state.users,
        devices: state.devices,
        sessions: state.sessions,
        products: state.products,
        stockMovements: state.stockMovements,
        sales: state.sales,
        customers: state.customers,
        budgets: state.budgets,
        cashRegister: state.cashRegister,
        cashHistory: state.cashHistory,
      }),
    }
  )
);
