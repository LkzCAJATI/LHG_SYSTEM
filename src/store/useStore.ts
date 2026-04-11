import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User, Device, Session, Product, Sale, Customer, Budget,
  CashRegister, CashBills, CashMovement, StockMovement, CartItem, DEFAULT_PRICES, ServiceOrder, BudgetItem,
  TechnicalDiagnosis, ServiceContract, PaymentEntry, Receipt, OSAttachmentCategory, OSAttachmentItem, OSPaymentSummary, OSAttachments
} from '../types';
import { useSettingsStore } from './settingsStore';
import { sessionRemainingSeconds } from '../utils/sessionRemaining';

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
  nextExternalIds: Record<string, number>; // key -> counter (ex: "os:L" / "budget:L")
  
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
  addDevice: (device: Omit<Device, 'id'> & { suggestedClientId?: string }) => void;
  updateDevice: (id: string, device: Partial<Device>) => void;
  deleteDevice: (id: string) => void;
  startSession: (deviceId: string, customerName: string, duration: number, extraControllers: number, customerId?: string, waitForClient?: boolean) => void;
  activateSession: (deviceId: string) => void;
  endSession: (sessionId: string) => void;
  endSessionSavingTime: (sessionId: string) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  addTimeToSession: (deviceId: string, minutes: number) => string | undefined;
  transferTimeBetweenDevices: (params: { fromDeviceId: string; toDeviceId: string }) => { ok: boolean; error?: string };
  
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
  updateSale: (id: string, sale: Partial<Sale>) => void;
  
  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalSpent' | 'visits'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCredits: (customerId: string, minutes: number) => void;
  removeCredits: (customerId: string, minutes: number) => void;
  
  // Budget Actions
  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'externalId' | 'userId' | 'userName'>, createdByUserId?: string) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  convertBudgetToSale: (budgetId: string, paymentMethod: Sale['paymentMethod'], installmentsCount?: number) => void;
  
  // OS Actions
  addServiceOrder: (os: Omit<ServiceOrder, 'id' | 'createdAt' | 'externalId' | 'userId' | 'userName'>, createdByUserId?: string) => string | null;
  updateServiceOrder: (id: string, os: Partial<ServiceOrder>) => void;
  deleteServiceOrder: (id: string) => void;
  convertOSToBudget: (osId: string) => void;
  saveOSDiagnosis: (osId: string, diagnosis: Omit<TechnicalDiagnosis, 'createdAt' | 'createdByUserId' | 'createdByUserName'>) => void;
  approveBudgetForOS: (budgetId: string) => void;
  setServiceOrderStatus: (osId: string, status: ServiceOrder['status']) => void;
  generateOSContract: (osId: string, payload: Omit<ServiceContract, 'id' | 'generatedAt'>) => void;
  registerOSPayment: (osId: string, payment: Omit<PaymentEntry, 'id' | 'osId' | 'paidAt' | 'userId' | 'userName' | 'receiptId'>) => Receipt | null;
  addOSAttachment: (osId: string, item: Omit<OSAttachmentItem, 'id' | 'createdAt'>) => void;
  addOSStageAttachment: (osId: string, stage: keyof OSAttachments, ref: Omit<OSAttachmentRef, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }) => void;
  removeOSStageAttachment: (osId: string, attachmentId: string) => void;
  
  // Cash Register Actions
  openCashRegister: (bills: CashBills) => void;
  closeCashRegister: () => void;
  addCashMovement: (movement: Omit<CashMovement, 'id' | 'createdAt' | 'userId' | 'userName'>) => void;
  
  // UI Actions
  setCurrentPage: (page: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const externalCounterKey = (type: 'os' | 'budget', prefix: string) => `${type}:${prefix}`;

const parseExternalIdCounter = (externalId: string | undefined, prefix: string) => {
  if (!externalId) return null;
  const m = externalId.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

const toMoney = (value: number) => Number((value || 0).toFixed(2));

const numberToWordsPtBr = (value: number) => {
  const normalized = toMoney(value);
  return `${normalized.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} reais`;
};

const emptyAttachments = (): OSAttachments => ({
  os: [],
  diagnostico: [],
  orcamento: [],
  contrato: [],
  pagamento: [],
  photos: [],
  videos: [],
  others: []
});

const pushHistory = (os: ServiceOrder, type: any, message: string, userId?: string, userName?: string) => ({
  ...os,
  history: [
    {
      id: generateId(),
      type,
      message,
      createdAt: new Date(),
      userId,
      userName
    },
    ...(os.history || [])
  ]
});

const normalizePaymentSummary = (summary: OSPaymentSummary | undefined, total: number): OSPaymentSummary => {
  const paid = toMoney(summary?.paid || 0);
  return {
    total: toMoney(total),
    paid,
    totalPaid: paid,
    pending: toMoney(Math.max(0, total - paid)),
    installments: summary?.installments || [],
    entries: summary?.entries || [],
    receipts: summary?.receipts || []
  };
};

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
        const user: User = { ...userData, id: generateId(), lastOSNumber: 0, createdAt: new Date() };
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
        const { suggestedClientId, ...rest } = deviceData;
        const raw = suggestedClientId?.trim();
        const id =
          raw && /^[a-zA-Z0-9._-]+$/.test(raw) && raw.length <= 64 ? raw : generateId();
        const device: Device = { ...rest, id };
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
      startSession: (deviceId, customerName, duration, extraControllers, customerId, waitForClient = false) => {
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
          // Se waitForClient=true, o startTime fica indefinido até activateSession ser chamado
          startTime: waitForClient ? undefined : new Date(),
          duration: duration * 60,
          extraControllers,
          totalPrice,
          paid: false,
          isPendingStart: waitForClient,
        };
        set(state => ({
          sessions: [...state.sessions, session],
          // O device fica 'in_use' mas com isPendingStart para a UI diferenciar
          devices: state.devices.map(d => d.id === deviceId ? { ...d, status: 'in_use', currentSession: session } : d),
        }));
      },
      activateSession: (deviceId) => {
        const device = get().devices.find(d => d.id === deviceId);
        const session = device?.currentSession;
        if (!session || !session.isPendingStart) return;
        const activated = { ...session, startTime: new Date(), isPendingStart: false };
        set(state => ({
          sessions: state.sessions.map(s => s.id === session.id ? activated : s),
          devices: state.devices.map(d => d.id === deviceId ? { ...d, currentSession: activated } : d),
        }));
        console.log(`[Smart Timer] Sessão ativada para o dispositivo: ${deviceId}`);
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
      addTimeToSession: (deviceIdOrClientId, minutes) => {
        const key = String(deviceIdOrClientId ?? '').trim();
        let device = get().devices.find((d) => d.id === key);
        if (!device) device = get().devices.find((d) => (d.networkClientId || '').trim() === key);
        if (!device || !device.currentSession) return undefined;
        const session = device.currentSession;
        const updated = { ...session, duration: session.duration + minutes };
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === session.id ? updated : s)),
          devices: state.devices.map((d) =>
            d.id === device!.id ? { ...d, currentSession: updated } : d
          ),
        }));
        return device.id;
      },

      transferTimeBetweenDevices: ({ fromDeviceId, toDeviceId }) => {
        const fid = String(fromDeviceId ?? '').trim();
        const tid = String(toDeviceId ?? '').trim();
        const fromDevice = get().devices.find(d => String(d.id).trim() === fid);
        const toDevice = get().devices.find(d => String(d.id).trim() === tid);

        if (!fromDevice || !toDevice) return { ok: false, error: 'Dispositivo inválido.' };
        const session = fromDevice.currentSession;
        if (!session || !session.startTime) return { ok: false, error: 'Sessão de origem não encontrada.' };
        if (toDevice.status !== 'available') return { ok: false, error: 'Dispositivo de destino não está disponível.' };

        const remainingSeconds = sessionRemainingSeconds(session);
        if (remainingSeconds <= 0) {
          return { ok: false, error: 'Não há tempo restante para transferir.' };
        }

        const transferDurationMin = remainingSeconds / 60;

        const newSessionId = generateId();
        const toIdStable = String(toDevice.id).trim();
        const transferredSession: Session = {
          id: newSessionId,
          deviceId: toIdStable,
          deviceName: toDevice.name,
          customerId: session.customerId,
          customerName: session.customerName,
          startTime: new Date(),
          duration: transferDurationMin,
          extraControllers: 0,
          totalPrice: 0,
          paid: session.paid,
          isPaused: false,
        };

        set((state) => {
          const sessionsBase = state.sessions.some((s) => s.id === session.id)
            ? state.sessions
            : [...state.sessions, { ...session }];

          const updatedSessions = sessionsBase.map((s) => {
            if (s.id !== session.id) return s;
            return { ...s, endTime: new Date() };
          });

          const appendedSessions = [transferredSession, ...updatedSessions];

          const updatedDevices = state.devices.map((d) => {
            const did = String(d.id).trim();
            if (did === fid) {
              return { ...d, status: 'available' as const, currentSession: undefined };
            }
            if (did === tid) {
              return { ...d, status: 'in_use' as const, currentSession: transferredSession };
            }
            return d;
          });

          return { sessions: appendedSessions, devices: updatedDevices };
        });

        return { ok: true };
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
          source: 'pdv',
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
      updateSale: (id, sale) => set(state => ({ sales: state.sales.map(s => s.id === id ? { ...s, ...sale } : s) })),

      // Customer Actions
      addCustomer: (c) =>
        set((state) => ({
          customers: [
            ...state.customers,
            {
              ...c,
              id: generateId(),
              totalSpent: 0,
              visits: 0,
              credits: typeof c.credits === 'number' && c.credits >= 0 ? c.credits : 0,
              balance: typeof c.balance === 'number' && c.balance >= 0 ? c.balance : 0,
              createdAt: new Date(),
            },
          ],
        })),
      updateCustomer: (id, c) => set(state => ({ customers: state.customers.map(cust => cust.id === id ? { ...cust, ...c } : cust) })),
      deleteCustomer: (id) => set(state => ({ customers: state.customers.filter(c => c.id !== id) })),
      addCredits: (id, m) => set(state => ({ customers: state.customers.map(c => c.id === id ? { ...c, credits: c.credits + m } : c) })),
      removeCredits: (id, m) => set(state => ({ customers: state.customers.map(c => c.id === id ? { ...c, credits: Math.max(0, c.credits - m) } : c) })),

      // OS Actions
      addServiceOrder: (osData, createdByUserId) => {
        const creator = createdByUserId
          ? get().users.find(u => u.id === createdByUserId) || get().currentUser
          : get().currentUser;
        const prefix = (creator?.prefix || 'T').toUpperCase();
        const key = externalCounterKey('os', prefix);
        const stateCounter = Math.max(get().nextExternalIds[key] || 0, creator?.lastOSNumber || 0);
        const maxFromExisting = get().serviceOrders.reduce((max, os) => {
          const n = parseExternalIdCounter(os.externalId, prefix);
          return n !== null ? Math.max(max, n) : max;
        }, 0);
        const counter = Math.max(stateCounter, maxFromExisting) + 1;
        const externalId = `${prefix}-${String(counter).padStart(3, '0')}`;
        const os: ServiceOrder = {
          ...osData,
          id: generateId(),
          externalId,
          userId: creator?.id || '',
          userName: creator?.name || '',
          createdAt: new Date(),
          attachmentsByCategory: osData.attachmentsByCategory || emptyAttachments(),
          history: [
            {
              id: generateId(),
              type: 'created',
              message: `OS criada por ${creator?.name || 'sistema'} com número ${externalId}.`,
              createdAt: new Date(),
              userId: creator?.id,
              userName: creator?.name
            }
          ],
          status: osData.status || 'em_diagnostico'
        };
        set(state => ({
          serviceOrders: [os, ...state.serviceOrders],
          nextExternalIds: { ...state.nextExternalIds, [key]: counter },
          users: state.users.map(u => (u.id === creator?.id ? { ...u, lastOSNumber: counter } : u))
        }));
        return os.id;
      },
      updateServiceOrder: (id, os) => set(state => ({ serviceOrders: state.serviceOrders.map(o => o.id === id ? { ...o, ...os } : o) })),
      deleteServiceOrder: (id) => set(state => ({ serviceOrders: state.serviceOrders.filter(os => os.id !== id) })),
      convertOSToBudget: (osId) => {
        const os = get().serviceOrders.find(o => o.id === osId);
        if (!os) return;
        const items: BudgetItem[] = os.selectedServices.map(s => ({ id: generateId(), type: 'service', description: s, quantity: 1, unitPrice: 0, totalPrice: 0 }));
        const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
        get().addBudget({
          customerName: os.customerName,
          customerCPF: os.customerCPF,
          customerPhone: os.customerPhone,
          items,
          subtotal,
          discount: 0,
          total: subtotal,
          osId: os.id,
          status: 'pending'
        });
        const currentUser = get().currentUser;
        set(state => ({
          serviceOrders: state.serviceOrders.map(order => {
            if (order.id !== os.id) return order;
            return pushHistory(
              { ...order, status: 'aguardando_aprovacao' },
              'budget_generated',
              'Orçamento gerado a partir do diagnóstico.',
              currentUser?.id,
              currentUser?.name
            );
          })
        }));
      },
      saveOSDiagnosis: (osId, diagnosis) => {
        const currentUser = get().currentUser;
        set(state => ({
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== osId) return os;
            return pushHistory(
              {
                ...os,
                diagnosis: {
                  ...diagnosis,
                  createdAt: new Date(),
                  createdByUserId: currentUser?.id || '',
                  createdByUserName: currentUser?.name || ''
                },
                status: 'aguardando_aprovacao'
              },
              'diagnosis_saved',
              'Diagnóstico técnico salvo.',
              currentUser?.id,
              currentUser?.name
            );
          })
        }));
      },
      approveBudgetForOS: (budgetId) => {
        const budget = get().budgets.find(b => b.id === budgetId);
        if (!budget) return;
        const currentUser = get().currentUser;
        set(state => ({
          budgets: state.budgets.map(b => (b.id === budgetId ? { ...b, status: 'approved' } : b)),
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== budget.osId) return os;
            const updated = pushHistory(
              { ...os, status: 'em_andamento' },
              'budget_approved',
              `Orçamento ${budget.externalId || budget.id} aprovado.`,
              currentUser?.id,
              currentUser?.name
            );
            return updated;
          })
        }));
        const policy = useSettingsStore.getState().settings.stockDeductionPolicy;
        if (policy === 'on_approval') {
          const userName = currentUser?.name || '';
          const userId = currentUser?.id || '';
          budget.items
            .filter(item => item.type === 'part')
            .forEach(item => {
              const product = get().products.find(p => p.name === item.description);
              if (!product) return;
              const qty = Number(item.quantity) || 0;
              if (qty <= 0) return;
              set(state => ({
                products: state.products.map(p => p.id === product.id ? { ...p, quantity: Math.max(0, p.quantity - qty) } : p),
                stockMovements: [
                  {
                    id: generateId(),
                    productId: product.id,
                    productName: product.name,
                    type: 'sale',
                    sourceType: 'service_order',
                    sourceId: budget.osId,
                    sourceExternalId: budget.externalId,
                    quantity: qty,
                    previousStock: product.quantity,
                    newStock: Math.max(0, product.quantity - qty),
                    userId,
                    userName,
                    createdAt: new Date()
                  },
                  ...state.stockMovements
                ],
                serviceOrders: state.serviceOrders.map(os => {
                  if (os.id !== budget.osId) return os;
                  return pushHistory(
                    { ...os, stockDeducted: true },
                    'stock_deducted',
                    `Baixa de estoque aplicada pela política de aprovação.`,
                    userId,
                    userName
                  );
                })
              }));
            });
        }
      },
      setServiceOrderStatus: (osId, status) => {
        const currentUser = get().currentUser;
        const os = get().serviceOrders.find(s => s.id === osId);
        if (!os) return;
        const from = os.status;
        
        let shouldReturnStock = false;
        let shouldRefund = false;
        let totalRefund = 0;

        if (status === 'canceled') {
           if (os.stockDeducted) {
             shouldReturnStock = true;
           }
           if (os.paymentSummary && os.paymentSummary.paid > 0) {
             shouldRefund = true;
             totalRefund = os.paymentSummary.paid;
           }
        }

        set(state => {
          let updatedProducts = state.products;
          let updatedStockMovements = state.stockMovements;
          const budget = state.budgets.find(b => b.osId === osId);

          if (shouldReturnStock && budget) {
            budget.items.filter(i => i.type === 'part').forEach(item => {
               const product = updatedProducts.find(p => p.name === item.description);
               if (product) {
                 const qty = Number(item.quantity) || 0;
                 if (qty > 0) {
                   updatedProducts = updatedProducts.map(p => 
                     p.id === product.id ? { ...p, quantity: p.quantity + qty } : p
                   );
                   updatedStockMovements = [
                     {
                       id: generateId(),
                       productId: product.id,
                       productName: product.name,
                       type: 'adjustment',
                       sourceType: 'service_order',
                       sourceId: osId,
                       sourceExternalId: os.externalId,
                       quantity: qty,
                       previousStock: product.quantity,
                       newStock: product.quantity + qty,
                       userId: currentUser?.id || '',
                       userName: currentUser?.name || '',
                       createdAt: new Date()
                     },
                     ...updatedStockMovements
                   ];
                 }
               }
            });
          }

          if (shouldRefund) {
             get().addCashMovement({
                type: 'withdrawal',
                amount: totalRefund,
                description: `Estorno de Cancelamento - OS ${os.externalId}`
             });
          }

          return {
            products: updatedProducts,
            stockMovements: updatedStockMovements,
            serviceOrders: state.serviceOrders.map(order => {
              if (order.id !== osId) return order;
              const stockDeducted = shouldReturnStock ? false : order.stockDeducted;
              
              // Se reverter o pagamento, limpa os pagamentos pagos
              let paymentSummary = order.paymentSummary;
              if (shouldRefund && paymentSummary) {
                 paymentSummary = {
                    ...paymentSummary,
                    paid: 0,
                    totalPaid: 0,
                    pending: paymentSummary.total,
                    entries: [
                      {
                        id: generateId(),
                        osId,
                        type: 'quitacao',
                        method: 'dinheiro',
                        amount: -totalRefund,
                        paidAt: new Date(),
                        userId: currentUser?.id || '',
                        userName: currentUser?.name || '',
                        notes: 'Estorno de Cancelamento'
                      },
                      ...paymentSummary.entries
                    ]
                 };
              }

              return pushHistory(
                { ...order, status, stockDeducted, paymentSummary },
                'status_changed',
                `Status alterado de ${from} para ${status}.${shouldReturnStock ? ' Estoque retornado.' : ''}${shouldRefund ? ` Estorno de R$ ${totalRefund.toFixed(2)} registrado.` : ''}`,
                currentUser?.id,
                currentUser?.name
              );
            })
          };
        });
      },
      generateOSContract: (osId, payload) => {
        const currentUser = get().currentUser;
        set(state => ({
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== osId) return os;
            return pushHistory(
              {
                ...os,
                contract: {
                  id: generateId(),
                  generatedAt: new Date(),
                  ...payload
                }
              },
              'contract_generated',
              'Contrato gerado para a OS.',
              currentUser?.id,
              currentUser?.name
            );
          })
        }));
      },
      registerOSPayment: (osId, payment) => {
        const currentUser = get().currentUser;
        const os = get().serviceOrders.find(order => order.id === osId);
        if (!os) return null;
        const budget = get().budgets.find(b => b.osId === osId);
        const total = budget?.total || os.paymentSummary?.total || 0;
        const summary = normalizePaymentSummary(os.paymentSummary, total);
        const entry: PaymentEntry = {
          id: generateId(),
          osId,
          type: payment.type,
          method: payment.method,
          amount: toMoney(payment.amount),
          installmentNumber: payment.installmentNumber,
          installmentsTotal: payment.installmentsTotal,
          notes: payment.notes,
          paidAt: new Date(),
          userId: currentUser?.id || '',
          userName: currentUser?.name || ''
        };
        const receipt: Receipt = {
          id: generateId(),
          receiptNumber: `${os.externalId}-R${String(summary.receipts.length + 1).padStart(3, '0')}`,
          osId,
          type: payment.type,
          customerName: os.customerName,
          customerCPF: os.customerCPF,
          amount: entry.amount,
          amountInWords: numberToWordsPtBr(entry.amount),
          description: `Recebi de ${os.customerName} referente a ${payment.type} da OS ${os.externalId}.`,
          paymentMethod: payment.method,
          installmentLabel: payment.installmentNumber && payment.installmentsTotal
            ? `${payment.installmentNumber}/${payment.installmentsTotal}`
            : undefined,
          issuedAt: new Date()
        };
        entry.receiptId = receipt.id;
        const paid = toMoney(summary.paid + entry.amount);
        const updatedSummary: OSPaymentSummary = {
          ...summary,
          paid,
          totalPaid: paid,
          pending: toMoney(Math.max(0, summary.total - paid)),
          entries: [entry, ...summary.entries],
          receipts: [receipt, ...summary.receipts]
        };
        set(state => ({
          serviceOrders: state.serviceOrders.map(order => {
            if (order.id !== osId) return order;
            return pushHistory(
              {
                ...order,
                paymentSummary: updatedSummary,
                status: updatedSummary.pending <= 0 ? 'finalizado' : 'aguardando_pagamento'
              },
              'payment_registered',
              `Pagamento ${payment.type} registrado: R$ ${entry.amount.toFixed(2)}.`,
              currentUser?.id,
              currentUser?.name
            );
          })
        }));

        // Integração direta com PDV
        get().addCashMovement({
           type: 'entry',
           amount: entry.amount,
           description: `Pagamento de OS #${os.externalId} - ${os.customerName}`
        });

        // Se política = on_completion, desconta estoque ao finalizar OS
        if (updatedSummary.pending <= 0) {
          const policy = useSettingsStore.getState().settings.stockDeductionPolicy;
          const currentOS = get().serviceOrders.find(o => o.id === osId);
          if (policy === 'on_completion' && currentOS && !currentOS.stockDeducted) {
            const budgetForOS = get().budgets.find(b => b.osId === osId);
            if (budgetForOS) {
              const userId = currentUser?.id || '';
              const userName = currentUser?.name || '';
              budgetForOS.items
                .filter(item => item.type === 'part')
                .forEach(item => {
                  const product = get().products.find(p => p.name === item.description);
                  if (!product) return;
                  const qty = Number(item.quantity) || 0;
                  if (qty <= 0) return;
                  set(state => ({
                    products: state.products.map(p => p.id === product.id ? { ...p, quantity: Math.max(0, p.quantity - qty) } : p),
                    stockMovements: [
                      {
                        id: generateId(),
                        productId: product.id,
                        productName: product.name,
                        type: 'sale',
                        sourceType: 'service_order',
                        sourceId: osId,
                        sourceExternalId: os.externalId,
                        quantity: qty,
                        previousStock: product.quantity,
                        newStock: Math.max(0, product.quantity - qty),
                        userId,
                        userName,
                        createdAt: new Date()
                      },
                      ...state.stockMovements
                    ],
                    serviceOrders: state.serviceOrders.map(o =>
                      o.id === osId
                        ? pushHistory({ ...o, stockDeducted: true }, 'stock_deducted', 'Baixa de estoque aplicada ao finalizar OS.', userId, userName)
                        : o
                    )
                  }));
                });
            }
          }

          // Cria venda no PDV para registro completo se OS finalizada
          // (histórico + relatório de receitas)
          const salesItems = budget ? budget.items.map(i => ({
            id: generateId(),
            name: i.description,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            totalPrice: Number(i.totalPrice) || 0,
          })) : [{ id: generateId(), name: `Serviço OS #${os.externalId}`, quantity: 1, unitPrice: updatedSummary.total, totalPrice: updatedSummary.total }];
        }

        return receipt;
      },
      addOSAttachment: (osId, item) => {
        const currentUser = get().currentUser;
        const map: Record<OSAttachmentCategory, keyof OSAttachments> = {
          os_signed: 'os',
          budget_signed: 'orcamento',
          contract_signed: 'contrato',
          receipt_signed: 'pagamento',
          photo: 'photos',
          video: 'videos',
          other: 'others'
        };
        set(state => ({
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== osId) return os;
            const existing = os.attachmentsByCategory || emptyAttachments();
            const key = map[item.category];
            const nextItem: OSAttachmentItem = {
              ...item,
              id: generateId(),
              createdAt: new Date()
            };
            const nextAttachments: OSAttachments = {
              ...existing,
              [key]: [nextItem, ...(existing[key] || [])]
            };
            return pushHistory(
              {
                ...os,
                attachmentsByCategory: nextAttachments,
                attachments: [...(os.attachments || []), item.filename]
              },
              'attachment_added',
              `Anexo adicionado em ${item.category}.`,
              currentUser?.id,
              currentUser?.name
            );
          })
        }));
      },

      addOSStageAttachment: (osId, stage, ref) => {
        const currentUser = get().currentUser;
        set(state => ({
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== osId) return os;
            const existing = os.attachmentsByCategory || emptyAttachments();
            const nextItem: OSAttachmentRef = {
              id: ref.id || generateId(),
              filename: ref.filename,
              label: ref.label,
              createdAt: ref.createdAt || new Date()
            };
            const nextAttachments: OSAttachments = {
              ...existing,
              [stage]: [nextItem, ...((existing as any)[stage] || [])]
            };
            return pushHistory(
              {
                ...os,
                attachmentsByCategory: nextAttachments,
                attachments: [...(os.attachments || []), nextItem.filename]
              },
              'attachment_added',
              `Anexo adicionado em ${stage}.`,
              currentUser?.id,
              currentUser?.name
            );
          })
        }));
      },

      removeOSStageAttachment: (osId, attachmentId) => {
        set(state => ({
          serviceOrders: state.serviceOrders.map(os => {
            if (os.id !== osId) return os;
            const existing = os.attachmentsByCategory || emptyAttachments();
            const next: OSAttachments = { ...existing };
            for (const key of Object.keys(next) as Array<keyof OSAttachments>) {
              const arr = (next as any)[key];
              if (Array.isArray(arr)) {
                (next as any)[key] = arr.filter((a: any) => a.id !== attachmentId);
              }
            }
            return { ...os, attachmentsByCategory: next };
          })
        }));
      },

      // Budget Actions
      addBudget: (b, createdByUserId) => {
        const creator = createdByUserId
          ? get().users.find(u => u.id === createdByUserId) || get().currentUser
          : get().currentUser;
        const prefix = (creator?.prefix || 'B').toUpperCase();
        const key = externalCounterKey('budget', prefix);
        const stateCounter = get().nextExternalIds[key] || 0;
        const maxFromExisting = get().budgets.reduce((max, bud) => {
          const n = parseExternalIdCounter(bud.externalId, prefix);
          return n !== null ? Math.max(max, n) : max;
        }, 0);
        const counter = Math.max(stateCounter, maxFromExisting) + 1;
        const externalId = `${prefix}-${String(counter).padStart(2, '0')}`;
        const budget: Budget = {
          ...b,
          id: generateId(),
          externalId,
          status: 'pending',
          userId: creator?.id || '',
          userName: creator?.name || '',
          createdAt: new Date()
        };
        set(state => ({ budgets: [budget, ...state.budgets], nextExternalIds: { ...state.nextExternalIds, [key]: counter } }));
        
        // Se este orçamento pertence a uma OS, atualizar o budgetId na OS
        if (budget.osId) {
          get().updateServiceOrder(budget.osId, { budgetId: budget.id } as any);
        }
        
        return budget.id;
      },
      updateBudget: (id, b) => {
        const oldBudget = get().budgets.find(bud => bud.id === id);
        if (!oldBudget) return;

        set(state => ({ budgets: state.budgets.map(bud => bud.id === id ? { ...bud, ...b } : bud) }));
        const updated = get().budgets.find(bud => bud.id === id);
        
        if (updated?.osId) {
           get().updateServiceOrder(updated.osId, { budgetId: updated.id } as any);
           
           const os = get().serviceOrders.find(o => o.id === updated.osId);
           if (os && os.stockDeducted) {
             const currentUser = get().currentUser;
             const userName = currentUser?.name || '';
             const userId = currentUser?.id || '';

             // Agrupar quantidades antigas e novas por produto
             const oldParts = oldBudget.items.filter(i => i.type === 'part');
             const newParts = updated.items.filter(i => i.type === 'part');

             const allProductNames = Array.from(new Set([
               ...oldParts.map(i => i.description),
               ...newParts.map(i => i.description)
             ]));

             allProductNames.forEach(name => {
               const oldQty = oldParts.filter(i => i.description === name).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
               const newQty = newParts.filter(i => i.description === name).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
               const diff = newQty - oldQty;

               if (diff === 0) return;

               const product = get().products.find(p => p.name === name);
               if (!product) return;

               // Ajustar estoque e registrar movimentação
               set(state => ({
                 products: state.products.map(p => p.id === product.id ? { ...p, quantity: Math.max(0, p.quantity - diff) } : p),
                 stockMovements: [
                   {
                     id: generateId(),
                     productId: product.id,
                     productName: product.name,
                     type: diff > 0 ? 'sale' : 'adjustment',
                     sourceType: 'service_order',
                     sourceId: os.id,
                     sourceExternalId: os.externalId,
                     quantity: Math.abs(diff),
                     previousStock: product.quantity,
                     newStock: Math.max(0, product.quantity - diff),
                     userId,
                     userName,
                     createdAt: new Date(),
                     notes: `Ajuste por alteração no orçamento.`
                   },
                   ...state.stockMovements
                 ]
               }));
             });

             // Registrar no histórico da OS
             set(state => ({
               serviceOrders: state.serviceOrders.map(o => 
                 o.id === os.id ? pushHistory(o, 'stock_recalculated', 'Estoque recalculado devido à alteração no orçamento.', userId, userName) : o
               )
             }));
           }
        }
      },
      deleteBudget: (id) => set(state => ({ budgets: state.budgets.filter(b => b.id !== id) })),
      convertBudgetToSale: (id, paymentMethod, installmentsCount) => {
        const budget = get().budgets.find(b => b.id === id);
        if (!budget) return;
        const sale: Sale = {
          id: generateId(),
          source: 'budget',
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
      migrate: (persisted: unknown) => {
        const p = persisted as { state?: { products?: Product[] } };
        if (p?.state?.products && Array.isArray(p.state.products)) {
          p.state.products = p.state.products.map((prod) => {
            const anyP = prod as Product & { imageUrl?: string; photo?: string; foto?: string };
            const img = anyP.image || anyP.imageUrl || anyP.photo || anyP.foto;
            if (!img || typeof img !== 'string') return prod;
            const t = img.trim();
            if (!t) return prod;
            return { ...prod, image: t };
          });
        }
        return persisted as typeof p;
      },
    }
  )
);
