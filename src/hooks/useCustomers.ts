
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useOnlineStatus } from './useProductsOffline';
import { getSessionSafe } from '@/lib/authSession';

import { useUserStore } from './useUserStore';

export interface Customer {
  id: string;
  name: string;
  rnc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customer_type?: 'final' | 'business' | null;
  credit_limit?: number | null;
  credit_used?: number | null;
  credit_due_date?: string | null;
  total_purchases?: number | null;
  last_purchase_date?: string | null;
  validation_code?: string | null;
  loyalty_points?: number | null;
  is_employee?: boolean | null;
  profile_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  store_id?: string | null;
}

export const useCustomers = () => {
  const isOnline = useOnlineStatus();
  const { data: store } = useUserStore();
  const storeId = store?.id;

  return useQuery({
    queryKey: ['customers', storeId],
    staleTime: Infinity, // MasterData: Never refetch automatically
    gcTime: Infinity, // MasterData: Keep in cache indefinitely
    refetchOnWindowFocus: false,
    enabled: !!storeId,
    queryFn: async () => {
      if (!storeId) return [];

      try {
        const session = await getSessionSafe();
        if (!session?.user) {
          // Offline: return from IndexedDB filtered by storeId
          const localCustomers = await offlineDB.getAll<Customer>(OfflineStore.CUSTOMERS);
          return localCustomers.filter(c => c.store_id === storeId);
        }

        if (!isOnline) {
          // Without internet, load from IndexedDB
          console.log('👥 Cargando clientes desde IndexedDB (modo offline)');
          const localCustomers = await offlineDB.getAll<Customer>(OfflineStore.CUSTOMERS);
          return localCustomers.filter(c => c.store_id === storeId);
        }

        // Build query - filter strictly by store_id
        let query = supabase
          .from('customers')
          .select('*')
          .eq('store_id', storeId)
          .order('name');

        let allData: Customer[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = [...allData, ...(data as Customer[])];
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }

        const customers = allData;

        // Guardar en IndexedDB en paralelo (mucho más rápido usando putBulk)
        // Solo guardamos los primeros 5000 para no saturar IndexedDB si son demasiados,
        // pero devolvemos todos al estado de la app.
        const syncLimit = 5000;
        await offlineDB.putBulk(OfflineStore.CUSTOMERS, customers.slice(0, syncLimit))
          .catch(e => console.warn('IndexedDB bulk write error (customers):', e));

        return customers;
      } catch (error) {
        // Fallback to IndexedDB on any error
        console.log('👥 Error en Supabase, cargando clientes desde IndexedDB:', error);
        const localCustomers = await offlineDB.getAll<Customer>(OfflineStore.CUSTOMERS);
        return localCustomers.filter(c => c.store_id === storeId);
      }
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          ...customer,
          store_id: profile?.store_id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: rpcError } = await supabase.rpc('delete_customer_cascade' as any, {
        target_customer_id: id
      });

      if (rpcError) {
        if (rpcError.message.includes('Could not find') || rpcError.message.includes('function delete_customer_cascade')) {
          throw new Error('FALTA_SQL_CLIENTE');
        }
        throw rpcError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
