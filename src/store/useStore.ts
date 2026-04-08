import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User, Device, Session, Product, Sale, Customer, Budget,
  CashRegister, CashBills, CashMovement, StockMovement, CartItem, DEFAULT_PRICES, ServiceOrder, BudgetItem
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

  // Service Orders
  serviceOrders: ServiceOrder[];
  nextExternalIds: Record<string, number>; // prefix -> counter
  
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
  addTimeToSession: (deviceId: string, minutes: number) => void;
  
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
  createSale: (paymentMethod: Sale['paymentMethod'], cashReceived?: number, downPayment?: Sale['downPayment']) => Sale | null;
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
  convertBudgetToSale: (budgetId: string, paymentMethod: Sale['paymentMethod'], installmentsCount?: number) => void;
  
  // OS Actions
  addServiceOrder: (os: Omit<ServiceOrder, 'id' | 'createdAt' | 'externalId' | 'userId' | 'userName'>) => void;
  updateServiceOrder: (id: string, os: Partial<ServiceOrder>) => void;
  deleteServiceOrder: (id: string) => void;
  convertOSToBudget: (osId: string) => void;
  
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
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `pc-${i + 1}`,
    name: `PC ${String(i + 1).padStart(2, '0')}`,
    type: 'pc' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.pc,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `ps5-${i + 1}`,
    name: `PS5 ${String.fromCharCode(65 + i)}`,
    type: 'playstation' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.playstation,
    consoleType: 'playstation' as const,
    extraControllers: 0,
  })),
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
  {
    id: 'arcade-1',
    name: 'Fliperama',
    type: 'arcade' as const,
    status: 'available' as const,
    pricePerHour: DEFAULT_PRICES.arcade,
  },
];

const defaultUsers: User[] = [
  {
    id: '1',
    name: 'Administrador',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    prefix: 'A',
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
      serviceOrders: [],
      nextExternalIds: {},
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
        const user: User = { ...userData, id: generateId(), createdAt: new Date() };
        set(state => ({ users: [...state.users, user] }));
      },
      updateUser: (id, userData) => {
        set(state => ({
          users: state.users.map(u => u.id === id ? { ...u, ...userData } : u),
        }));
      },
      deleteUser: (id) => {
        set(state => ({ users: state.users.filter(u => u.id !== id) }));
      },

      // Device Actions
      addDevice: (deviceData) => {
        const device: Device = { ...deviceData, id: generateId() };
        set(state => ({ devices: [...state.devices, device] }));
      },
      updateDevice: (id, deviceData) => {
        set(state => ({
          devices: state.devices.map(d => d.id === id ? { ...d, ...deviceData } : d),
        }));
      },
      deleteDevice: (id) => {
        set(state => ({ devices: state.devices.filter(d => d.id !== id) }));
      },
      startSession: (deviceId, customerName, duration, extraControllers, customerId) => {
        const device = get().devices.find(d => d.id === deviceId);
        if (!device) return;
        const pricePerHour = device.pricePerHour;
        let extraPrice = 0;
        if (device.type === 'console' && extraControllers > 0) {
          extraPrice = extraControllers * DEFAULT_PRICES.extraController * duration;
        }
        const totalPrice = (pricePerHour * duration) + extraPrice;
        const session: Session = {
          id: generateId(),
          deviceId,
          deviceName: device.name,
          customerId,
          customerName,
          startTime: new Date(),
          duration: duration * 60,
          extraControllers,
          totalPrice,
          paid: false,
        };
        set(state => ({
          sessions: [...state.sessions, session],
          devices: state.devices.map(d => d.id === deviceId ? { ...d, status: 'in_use', currentSession: session } : d),
        }));
      },
      endSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;
        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? { ...s, endTime: new Date(), paid: true } : s),
          devices: state.devices.map(d => d.id === session.deviceId ? { ...d, status: 'available', currentSession: undefined } : d),
        }));
      },
      endSessionSavingTime: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;
        const now = new Date().getTime();
        const diff = now - new Date(session.startTime).getTime();
        const elapsedSeconds = Math.floor(diff / 1000);
        const totalSeconds = session.duration * 60;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? { ...s, endTime: new Date(), paid: true } : s),
          devices: state.devices.map(d => d.id === session.deviceId ? { ...d, status: 'available', currentSession: undefined } : d),
        }));
        if (session.customerId && remainingMinutes > 0) {
          get().addCredits(session.customerId, remainingMinutes);
        }
      },
      pauseSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session || session.isPaused) return;
        const updated = { ...session, isPaused: true, pausedAt: new Date() };
        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
          devices: state.devices.map(d => d.id === session.deviceId ? { ...d, status: 'paused', currentSession: updated } : d)
        }));
      },
      resumeSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session || !session.isPaused || !session.pausedAt) return;
        const pausedMs = new Date().getTime() - new Date(session.pausedAt).getTime();
        const updated = { ...session, isPaused: false, pausedAt: undefined, totalPausedTime: (session.totalPausedTime || 0) + pausedMs };
        set(state => ({
          sessions: state.sessions.map(s => s.id === sessionId ? updated : s),
          devices: state.devices.map(d => d.id === session.deviceId ? { ...d, status: 'in_use', currentSession: updated } : d)
        }));
      },
      addTimeToSession: (deviceId, minutes) => {
        const device = get().devices.find(d => d.id === deviceId);
        if (!device || !device.currentSession) return;
        const session = device.currentSession;
        const updated = { ...session, duration: session.duration + minutes };
        set(state => ({
          sessions: state.sessions.map(s => s.id === session.id ? updated : s),
          devices: state.devices.map(d => d.id === deviceId ? { ...d, currentSession: updated } : d)
        }));
      },

      // Product Actions
      addProduct: (p) => set(state => ({ products: [...state.products, { ...p, id: generateId() }] })),
      updateProduct: (id, p) => set(state => ({ products: state.products.map(prod => prod.id === id ? { ...prod, ...p } : prod) })),
      deleteProduct: (id) => set(state => ({ products: state.products.filter(p => p.id !== id) })),
      adjustStock: (productId, quantity, type) => {
        const product = get().products.find(p => p.id === productId);
        if (!product) return;
        const newStock = type === 'sale' ? product.quantity - quantity : product.quantity + quantity;
        set(state => ({
          products: state.products.map(p => p.id === productId ? { ...p, quantity: newStock } : p),
          stockMovements: [...state.stockMovements, { id: generateId(), productId, productName: product.name, type, quantity, previousStock: product.quantity, newStock, userId: get().currentUser?.id || '', userName: get().currentUser?.name || '', createdAt: new Date() }]
        }));
      },

      // Cart Actions
      addToCart: (item) => set(state => ({ cart: [...state.cart, { ...item, id: generateId() }] })),
      removeFromCart: (id) => set(state => ({ cart: state.cart.filter(i => i.id !== id) })),
      updateCartItem: (id, item) => set(state => ({ cart: state.cart.map(i => i.id === id ? { ...i, ...item } : i) })),
      clearCart: () => set({ cart: [] }),

      // Sale Actions
      createSale: (paymentMethod, cashReceived, downPayment) => {
        const { cart, currentUser } = get();
        if (!currentUser) return null;
        const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
        const sale: Sale = {
          id: generateId(),
          items: [...cart],
          subtotal,
          discount: 0,
          total: subtotal,
          paymentMethod,
          cashReceived,
          change: cashReceived ? cashReceived - subtotal : 0,
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: new Date(),
          downPayment,
        };
        if (downPayment && downPayment.amount > 0) {
          get().addCashMovement({ type: 'sale', amount: downPayment.amount, description: `Entrada Venda #${sale.id.substring(0,6)}` });
        } else if (paymentMethod !== 'installment') {
          get().addCashMovement({ type: 'sale', amount: subtotal, description: `Venda #${sale.id.substring(0,6)}` });
        }
        set(state => ({ sales: [sale, ...state.sales], cart: [] }));
        return sale;
      },
      addSale: (sale) => set(state => ({ sales: [sale, ...state.sales] })),

      // Customer Actions
      addCustomer: (c) => set(state => ({ customers: [...state.customers, { ...c, id: generateId(), totalSpent: 0, visits: 0, credits: 0, balance: 0, createdAt: new Date() }] })),
      updateCustomer: (id, c) => set(state => ({ customers: state.customers.map(cust => cust.id === id ? { ...cust, ...c } : cust) })),
      deleteCustomer: (id) => set(state => ({ customers: state.customers.filter(c => c.id !== id) })),
      addCredits: (id, m) => set(state => ({ customers: state.customers.map(c => c.id === id ? { ...c, credits: c.credits + m } : c) })),
      removeCredits: (id, m) => set(state => ({ customers: state.customers.map(c => c.id === id ? { ...c, credits: Math.max(0, c.credits - m) } : c) })),

      // OS Actions
      addServiceOrder: (osData) => {
        const prefix = get().currentUser?.prefix || 'T';
        const counter = (get().nextExternalIds[prefix] || 0) + 1;
        const externalId = `${prefix}-${String(counter).padStart(2, '0')}`;
        const os: ServiceOrder = { ...osData, id: generateId(), externalId, userId: get().currentUser?.id || '', userName: get().currentUser?.name || '', createdAt: new Date() };
        set(state => ({ serviceOrders: [os, ...state.serviceOrders], nextExternalIds: { ...state.nextExternalIds, [prefix]: counter } }));
      },
      updateServiceOrder: (id, os) => set(state => ({ serviceOrders: state.serviceOrders.map(o => o.id === id ? { ...o, ...os } : o) })),
      deleteServiceOrder: (id) => set(state => ({ serviceOrders: state.serviceOrders.filter(os => os.id !== id) })),
      convertOSToBudget: (osId) => {
        const os = get().serviceOrders.find(o => o.id === osId);
        if (!os) return;
        const items: BudgetItem[] = os.selectedServices.map(s => ({ id: generateId(), type: 'service', description: s, quantity: 1, unitPrice: 0, totalPrice: 0 }));
        get().addBudget({
          customerName: os.customerName,
          items,
          subtotal: 0,
          discount: 0,
          total: 0,
          osId: os.id,
          status: 'pending'
        });
        get().updateServiceOrder(os.id, { status: 'analyzing' });
      },

      // Budget Actions
      addBudget: (b) => {
        const prefix = get().currentUser?.prefix || 'B';
        const counter = (get().nextExternalIds[prefix] || 0) + 1;
        const externalId = `${prefix}-${String(counter).padStart(2, '0')}`;
        const budget: Budget = { ...b, id: generateId(), externalId, status: 'pending', createdAt: new Date() };
        set(state => ({ budgets: [budget, ...state.budgets], nextExternalIds: { ...state.nextExternalIds, [prefix]: counter } }));
      },
      updateBudget: (id, b) => set(state => ({ budgets: state.budgets.map(bud => bud.id === id ? { ...bud, ...b } : bud) })),
      deleteBudget: (id) => set(state => ({ budgets: state.budgets.filter(b => b.id !== id) })),
      convertBudgetToSale: (id, paymentMethod, installmentsCount) => {
        const budget = get().budgets.find(b => b.id === id);
        if (!budget) return;
        const sale: Sale = {
          id: generateId(),
          items: budget.items.map(i => ({ id: generateId(), type: i.type === 'part' ? 'product' : 'time', name: i.description, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
          subtotal: budget.subtotal,
          discount: budget.discount,
          total: budget.total,
          paymentMethod,
          userId: get().currentUser?.id || '',
          userName: get().currentUser?.name || '',
          createdAt: new Date(),
          externalId: budget.externalId,
          downPayment: budget.downPayment ? { ...budget.downPayment, date: new Date() } : undefined,
        };
        if (paymentMethod === 'installment' && installmentsCount) {
          const instAmount = (sale.total - (sale.downPayment?.amount || 0)) / installmentsCount;
          sale.installments = Array.from({ length: installmentsCount }, (_, i) => ({ id: generateId(), number: i + 1, amount: instAmount, dueDate: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' }));
        }
        set(state => ({ sales: [sale, ...state.sales], budgets: state.budgets.map(b => b.id === id ? { ...b, status: 'converted', saleId: sale.id } : b) }));
      },

      // Cash Action
      openCashRegister: (bills) => {
        const total = Object.entries(bills).reduce((s, [v, q]) => s + (Number(v) * (q as number)), 0);
        const register: CashRegister = { id: generateId(), openedAt: new Date(), initialAmount: total, currentAmount: total, totalSales: 0, totalEntries: 0, totalExits: 0, status: 'open', bills, movements: [{ id: generateId(), type: 'entry', amount: total, description: 'Abertura', userId: get().currentUser?.id || '', userName: get().currentUser?.name || '', createdAt: new Date() }] };
        set({ cashRegister: register });
      },
      closeCashRegister: () => {
        const register = get().cashRegister;
        if (!register) return;
        set(state => ({ cashRegister: null, cashHistory: [{ ...register, closedAt: new Date(), status: 'closed' }, ...state.cashHistory] }));
      },
      addCashMovement: (m) => {
        const register = get().cashRegister;
        if (!register) return;
        const movement: CashMovement = { ...m, id: generateId(), userId: get().currentUser?.id || '', userName: get().currentUser?.name || '', createdAt: new Date() };
        const change = m.type === 'entry' || m.type === 'sale' ? m.amount : -m.amount;
        set(state => ({
          cashRegister: state.cashRegister ? {
            ...state.cashRegister,
            currentAmount: state.cashRegister.currentAmount + change,
            totalEntries: m.type === 'entry' ? state.cashRegister.totalEntries + m.amount : state.cashRegister.totalEntries,
            totalExits: m.type === 'exit' ? state.cashRegister.totalExits + m.amount : state.cashRegister.totalExits,
            movements: [movement, ...state.cashRegister.movements]
          } : null
        }));
      },

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
        serviceOrders: state.serviceOrders,
        nextExternalIds: state.nextExternalIds,
        cashRegister: state.cashRegister,
        cashHistory: state.cashHistory,
      }),
    }
  )
);
