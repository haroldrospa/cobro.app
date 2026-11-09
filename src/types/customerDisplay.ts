export type CustomerDisplayStatus = 'idle' | 'scanning' | 'payment' | 'completed';

export interface DisplayCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image_url?: string;
  extras?: Array<{ name: string; price: number; quantity: number }>;
  discount?: {
    value: number;
    type: 'percentage' | 'amount';
  };
}

export interface LastScannedItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image_url?: string;
  timestamp: number;
}

export interface PaymentDisplayInfo {
  paymentMethod: string;
  paymentMethodLabel?: string;
  total: number;
  amountPaid?: number;
  change?: number;
}

export interface CompletedSaleDisplayInfo {
  invoiceNumber: string;
  total: number;
  amountPaid?: number;
  change?: number;
  qrCodeUrl?: string;
  customerName?: string;
}

export interface CustomerDisplayPayload {
  status: CustomerDisplayStatus;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  registerId: string;
  registerName: string;
  cart: DisplayCartItem[];
  lastItem?: LastScannedItem;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemsCount: number;
  payment?: PaymentDisplayInfo;
  completed?: CompletedSaleDisplayInfo;
  updatedAt: number;
}
