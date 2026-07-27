export interface CartItemExtra {
  id: string;
  name: string;
  price: number;
  quantity: number;
  ingredient_id?: string;
  recipe_quantity?: number;
}

export interface CartItem {
  id: string;
  cartItemId?: string;
  name: string;
  price: number;
  quantity: number;
  tax: number;
  cost_includes_tax?: boolean;
  image_url?: string;
  comment?: string;
  selectedExtras?: CartItemExtra[];
  originalPrice?: number;
  discount?: {
    value: number;
    type: 'percentage' | 'amount';
  };
  offerApplied?: {
    id: string;
    name?: string;
    quantity: number;
    price: number;
    savings: number;
  };
}

export interface GlobalDiscount {
  value: number;
  type: 'percentage' | 'amount';
}

export interface InvoiceType {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
  category: string;
}

export interface Customer {
  id: string;
  name: string;
  rnc: string;
  type: string;
}

// Información completa del carrito guardado, incluyendo metadata de la orden
export interface SavedCartData {
  items: CartItem[];
  orderMetadata?: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    notes?: string;
    source: 'pos' | 'web';
  };
  globalDiscount?: GlobalDiscount;
  selectedCustomer?: string;
}
