export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'employee';
  prefix: string; // Ex: 'L' para Lucas, 'S' para Sergio
  createdAt: Date;
}

export interface Device {
  id: string;
  name: string;
  type: 'pc' | 'playstation' | 'console' | 'arcade';
  status: 'available' | 'in_use' | 'paused' | 'maintenance';
  currentSession?: Session;
  pricePerHour: number;
  consoleType?: 'playstation' | 'xbox' | 'switch' | 'other';
  extraControllers?: number;
  // Controle remoto para PCs
  ip?: string;
  mac?: string;
  isConnected?: boolean;
  lastSeen?: Date;
  os?: string;
}

export interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  customerId?: string;
  customerName?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // em minutos
  extraControllers: number;
  totalPrice: number;
  paid: boolean;
  isPaused?: boolean;
  pausedAt?: Date;
  totalPausedTime?: number; // In milliseconds
}

export interface ServiceOrder {
  id: string;
  externalId: string; // Ex: S-17
  customerId?: string;
  customerName: string;
  customerCPF?: string;
  customerPhone?: string;
  isOver18: boolean;
  
  // Dados do Aparelho
  deviceType: 'pc' | 'notebook' | 'console' | 'celular' | 'outro';
  deviceBrandModel: string;
  serialNumber: string;
  physicalState: string; // riscos, trincos, acessórios
  
  // Serviços
  selectedServices: string[]; // ['diagnóstico', 'formatação', ...]
  otherService?: string;
  
  status: 'open' | 'analyzing' | 'ready' | 'delivered' | 'canceled';
  notes?: string;
  
  userId: string;
  userName: string;
  createdAt: Date;
  deliveredAt?: Date;
  
  budgetId?: string; // Vínculo com orçamento se gerado
  attachments?: string[]; // Caminhos dos arquivos anexados (PDF/Fotos)
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  minStock: number;
  image?: string;
}

export interface CartItem {
  id: string;
  type: 'product' | 'time' | 'trade_in';
  productId?: string;
  deviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  duration?: number; // em minutos para tempo
  extraControllers?: number;
  customerId?: string;
  customerName?: string;
}

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'pix' | 'card' | 'mixed' | 'installment';
  cashReceived?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  userId: string;
  userName: string;
  createdAt: Date;
  externalId?: string; // Numeração personalizada baseada no vendedor
  contractGenerated?: boolean;
  attachments?: string[]; // Caminhos dos arquivos anexados (PDF/Fotos)
  
  // Financeiro
  downPayment?: {
    amount: number;
    method: string;
    date: Date;
  };
  
  // Parcelamento
  installments?: {
    id: string;
    number: number;
    amount: number;
    dueDate: string; // ISO string
    status: 'pending' | 'paid' | 'overdue';
    paidAt?: string;
  }[];
}

export interface Customer {
  id: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  address?: string;
  credits: number; // em minutos
  balance: number; // em reais
  totalSpent: number;
  visits: number;
  createdAt: Date;
  lastLogin?: Date;
  usedMinutes?: number; // minutos utilizados na sessão atual
}

export interface BudgetItem {
  id: string;
  type: 'part' | 'service' | 'console' | 'accessory' | 'trade_in';
  description: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Budget {
  id: string;
  customerId?: string;
  customerName?: string;
  items: BudgetItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  status: 'pending' | 'approved' | 'converted';
  saleId?: string;
  osId?: string; // Vínculo com a OS de origem
  externalId?: string; // Ex: L-14
  downPayment?: {
    amount: number;
    method: string;
  };
  createdAt: Date;
}

export interface CashRegister {
  id: string;
  openedAt: Date;
  closedAt?: Date;
  initialAmount: number;
  currentAmount: number;
  totalSales: number;
  totalEntries: number;
  totalExits: number;
  status: 'open' | 'closed';
  bills: CashBills;
  movements: CashMovement[];
}

export interface CashBills {
  2: number;
  5: number;
  10: number;
  20: number;
  50: number;
  100: number;
}

export interface CashMovement {
  id: string;
  type: 'entry' | 'exit' | 'sale' | 'withdrawal';
  amount: number;
  description: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'entry' | 'sale' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface NetworkClient {
  id: string;
  deviceId?: string;
  deviceName?: string;
  ip: string;
  connected: boolean;
  lastSeen: Date;
}

// Preços padrão do sistema
export const DEFAULT_PRICES = {
  pc: 5, // R$ 5/hora
  playstation: 6, // R$ 6/hora
  xbox: 6, // R$ 6/hora
  switch: 6, // R$ 6/hora
  other_console: 6, // R$ 6/hora
  arcade: 5, // R$ 5/hora
  extraController: 3, // R$ 3 por controle extra
};
