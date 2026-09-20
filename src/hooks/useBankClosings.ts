import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface BankSessionItem {
  id: string;
  store_id: string;
  opened_by: string;
  closed_by?: string;
  opened_at: string;
  closed_at?: string;
  created_at?: string;
  initial_cash: number;
  status: 'open' | 'closed';
  total_sales_cash?: number;
  total_sales_card?: number;
  total_sales_transfer?: number;
  total_sales_other?: number;
  total_refunds?: number;
  total_cash_in?: number;
  total_cash_out?: number;
  expected_cash?: number;
  actual_cash?: number;
  difference?: number;
  notes?: string;
  opener?: { id?: string; full_name?: string; role?: string };
  closer?: { id?: string; full_name?: string; role?: string };
}

export interface SessionDetailSales {
  id: string;
  invoice_number?: string;
  ncf?: string;
  customer_name?: string;
  payment_method: string;
  total: number;
  split_cash?: number;
  split_method?: string;
  created_at: string;
  status?: string;
}

export interface SessionDetailMovement {
  id: string;
  type: string;
  amount: number;
  reason?: string;
  created_at: string;
  user?: { full_name?: string };
}

export const useBankClosings = (options?: { dateFrom?: Date | null; dateTo?: Date | null }) => {
  const { profile } = useUserProfile();
  const storeId = profile?.store_id;

  return useQuery({
    queryKey: ['bank-closings', storeId, options?.dateFrom?.toISOString(), options?.dateTo?.toISOString()],
    queryFn: async (): Promise<BankSessionItem[]> => {
      if (!storeId) return [];

      let query = supabase
        .from('cash_sessions')
        .select(`
          id,
          store_id,
          opened_by,
          closed_by,
          opened_at,
          closed_at,
          created_at,
          initial_cash,
          status,
          total_sales_cash,
          total_sales_card,
          total_sales_transfer,
          total_sales_other,
          total_refunds,
          total_cash_in,
          total_cash_out,
          expected_cash,
          actual_cash,
          difference,
          notes,
          opener:opened_by(id, full_name, role),
          closer:closed_by(id, full_name, role)
        `)
        .eq('store_id', storeId)
        .order('opened_at', { ascending: false })
        .limit(100);

      if (options?.dateFrom) {
        query = query.gte('opened_at', options.dateFrom.toISOString());
      }
      if (options?.dateTo) {
        query = query.lte('opened_at', options.dateTo.toISOString());
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching bank closings:', error);
        throw error;
      }

      return (data as any) || [];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 3,
  });
};

export const fetchSessionSales = async (
  storeId: string,
  openedAt: string,
  closedAt?: string
): Promise<SessionDetailSales[]> => {
  const start = new Date(openedAt);
  start.setMinutes(start.getMinutes() - 1);

  let query = supabase
    .from('sales')
    .select('id, invoice_number, ncf, customer_name, payment_method, total, split_cash, split_method, created_at, status')
    .eq('store_id', storeId)
    .gte('created_at', start.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(300);

  if (closedAt) {
    const end = new Date(closedAt);
    end.setMinutes(end.getMinutes() + 1);
    query = query.lte('created_at', end.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching session sales:', error);
    return [];
  }
  return (data as any) || [];
};

export const fetchSessionMovements = async (
  storeId: string,
  openedAt: string,
  closedAt?: string
): Promise<SessionDetailMovement[]> => {
  const start = new Date(openedAt);
  start.setMinutes(start.getMinutes() - 2);

  let query = supabase
    .from('cash_movements')
    .select('id, type, amount, reason, created_at, user:user_id(full_name)')
    .eq('store_id', storeId)
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (closedAt) {
    const end = new Date(closedAt);
    end.setMinutes(end.getMinutes() + 2);
    query = query.lte('created_at', end.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching session movements:', error);
    return [];
  }
  return (data as any) || [];
};
