export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'employee';
  createdAt: Date;
}

export interface Device {
  id: string;
  name: string;
  type: 'pc' | 'playstation' | 'console' | 'arcade';
  status: 'available' | 'in_use' | 'maintenance';
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
  type: 'product' | 'time';
  productId?: string;
  deviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  duration?: number; // em minutos para tempo
  extraControllers?: number;
}

export interface Sale {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'pix' | 'card' | 'mixed';
  cashReceived?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
  email?: string;
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
  type: 'part' | 'service' | 'console' | 'accessory';
  description: string;
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
