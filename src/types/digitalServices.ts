export type DigitalServiceType = 'recharge' | 'data_package' | 'bill_payment' | 'prepaid_power' | 'remittance' | 'gaming_pincode';

export type CarrierType = string;

export interface DigitalServiceWallet {
  id: string;
  store_id: string;
  balance: number;
  credit_limit: number;
  total_sold: number;
  total_cost: number;
  total_commission: number;
  custom_commission_rate?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DigitalServiceTransaction {
  id: string;
  store_id: string;
  user_id?: string;
  service_type: DigitalServiceType;
  carrier: CarrierType | string;
  target_number: string;
  target_name?: string;
  amount: number;
  amount_charged: number;
  commission: number;
  client_reference_id: string;
  external_id?: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DigitalServicesConfig {
  id: string;
  api_environment: 'sandbox' | 'production';
  api_base_url: string;
  default_recharge_commission_rate: number;
  default_bill_fixed_commission: number;
  deposit_bank_details?: string;
  is_active: boolean;
}

export interface DigitalPackageOption {
  id: string;
  carrier: CarrierType;
  name: string;
  validity: string;
  price: number;
  description: string;
}
