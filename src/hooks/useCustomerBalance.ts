import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingSale {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  balance: number; // total - amount_paid
  due_date: string | null;
  created_at: string;
}

export const useCustomerBalance = (customerId?: string) => {
  return useQuery({
    queryKey: ['customerBalance', customerId],
    queryFn: async () => {
      if (!customerId) return { totalDebt: 0, pendingSales: [] };

      const query = supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .neq('payment_status', 'paid') // Include pending, partial, etc.
        .neq('status', 'cancelled') // Exclude cancelled
        .order('due_date', { ascending: true });

      // REMOVED store_id filter to show GLOBAL debt across all stores/legacy data
      // This aligns with the 'Customers' page logic.

      const allData: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const data = allData;

      console.log('📊 Customer Balance Query Result:', {
        customerId,
        rawData: data,
        count: data?.length || 0
      });

      // Calculate balance for each sale (total - amount_paid)
      const pendingSales: PendingSale[] = (data || []).map(sale => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        total: sale.total,
        // Fallback: If amount_paid is null/undefined, assume 0
        amount_paid: sale.amount_paid || 0,
        balance: sale.total - (sale.amount_paid || 0),
        due_date: sale.due_date,
        created_at: sale.created_at!,
      }));

      // Total debt is the sum of remaining balances
      const totalDebt = pendingSales.reduce((sum, sale) => sum + sale.balance, 0);

      console.log('💰 Calculated Balance:', {
        customerId,
        totalDebt,
        pendingSalesCount: pendingSales.length,
        pendingSales
      });

      return {
        totalDebt,
        pendingSales,
      };
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useAllCustomersBalances = () => {
  return useQuery({
    queryKey: ['allCustomersBalances', 'v3'],
    queryFn: async () => {
      // Get all sales that are not fully paid
      // We filter out only 'paid' status to capture pending, partial, etc.
      const allData: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('sales')
          .select('customer_id, total, amount_paid, due_date, payment_status, status')
          .neq('payment_status', 'paid')
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('Error fetching customer balances:', error);
          throw error;
        }

        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const data = allData;

      console.log('Fetched sales for balances:', data?.length || 0, data);

      // Group by customer_id
      const balances: Record<string, number> = {};
      const overdueCustomers = new Set<string>();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data?.forEach((sale: any) => {
        if (sale.customer_id) {
          // Skip cancelled sales
          if (sale.status === 'cancelled') return;

          const debt = sale.total - (sale.amount_paid || 0);

          // Only add to balance if there's actual debt
          if (debt > 0) {
            balances[sale.customer_id] = (balances[sale.customer_id] || 0) + debt;

            if (sale.due_date) {
              const dueDate = new Date(sale.due_date);
              // Use timestamp comparison
              if (dueDate.getTime() < today.getTime()) {
                overdueCustomers.add(sale.customer_id);
              }
            }
          }
        }
      });

      console.log('Calculated balances:', balances);
      console.log('Overdue customers:', Array.from(overdueCustomers));

      return { balances, overdueCustomers };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};
