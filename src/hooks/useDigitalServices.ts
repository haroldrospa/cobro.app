import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { DigitalServiceWallet, DigitalServiceTransaction, DigitalServicesConfig } from '@/types/digitalServices';
import { toast } from '@/hooks/use-toast';

export const useDigitalServices = () => {
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  const storeId = userStore?.id;

  // 1. Obtener la Billetera de la Tienda
  const {
    data: wallet,
    isLoading: isLoadingWallet,
    refetch: refetchWallet
  } = useQuery<DigitalServiceWallet | null>({
    queryKey: ['digital-services-wallet', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data, error } = await supabase
        .from('digital_services_wallets')
        .select('id, store_id, balance, credit_limit, total_sold, total_cost, total_commission, custom_commission_rate, is_active, created_at, updated_at')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        console.warn('Error al obtener billetera de servicios:', error.message);
        return null;
      }

      if (!data) {
        // Inicializar billetera vía RPC segura
        const { data: createdWallet, error: rpcError } = await supabase
          .rpc('get_or_create_store_wallet', { p_store_id: storeId });
        if (rpcError) {
          console.error('Error al inicializar billetera:', rpcError);
          return null;
        }
        return createdWallet as DigitalServiceWallet;
      }

      return data as DigitalServiceWallet;
    },
    enabled: !!storeId,
    staleTime: 1000 * 30, // 30 segundos
  });

  // 2. Obtener Configuración Global de la Plataforma
  const { data: config } = useQuery<DigitalServicesConfig | null>({
    queryKey: ['digital-services-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('digital_services_config')
        .select('id, api_environment, api_base_url, default_recharge_commission_rate, default_bill_fixed_commission, deposit_bank_details, is_active')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error config digital services:', error);
        return null;
      }
      return data as DigitalServicesConfig;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });

  // 3. Mutación para Procesar Venta de Recarga / Servicio
  const processSaleMutation = useMutation({
    mutationFn: async (payload: {
      carrier: string;
      phone: string;
      amount: number;
      service_type: 'recharge' | 'data_package' | 'bill_payment' | 'prepaid_power';
      target_name?: string;
      package_id?: string;
    }) => {
      if (!storeId) throw new Error('No se ha detectado el comercio actual.');

      const clientReferenceId = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Llamada a la Edge Function segura
      const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
        body: {
          action: 'recharge',
          carrier: payload.carrier,
          phone: payload.phone,
          amount: payload.amount,
          service_type: payload.service_type,
          target_name: payload.target_name,
          package_id: payload.package_id,
          client_reference_id: clientReferenceId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error de conexión con el servicio de recargas.');
      }

      if (!data?.ok) {
        throw new Error(data?.error || 'No se pudo completar la transacción.');
      }

      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-wallet', storeId] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-transactions', storeId] });
      toast({
        title: '¡Transacción Exitosa! 🎉',
        description: `Recarga de RD$ ${data.amount} aplicada a ${data.carrier.toUpperCase()} (${data.target_number}). Ganaste RD$ ${data.commission} de comisión.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al procesar recarga',
        description: err.message || 'Ocurrió un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  // 4. Mutación para Agregar Saldo a la Billetera (Simulación / Admin)
  const addBalanceMutation = useMutation({
    mutationFn: async ({ amount, description, reference }: { amount: number; description?: string; reference?: string }) => {
      if (!storeId) throw new Error('No hay comercio activo');
      const { data, error } = await supabase.rpc('add_store_digital_balance', {
        p_store_id: storeId,
        p_amount: amount,
        p_description: description || 'Recarga de saldo manual',
        p_reference: reference || null
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-wallet', storeId] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-movements', storeId] });
      toast({
        title: 'Saldo acreditado',
        description: 'La billetera de recargas ha sido actualizada con éxito.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al recargar saldo',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  return {
    wallet,
    config,
    isLoadingWallet,
    refetchWallet,
    processSale: processSaleMutation.mutateAsync,
    isProcessingSale: processSaleMutation.isPending,
    addBalance: addBalanceMutation.mutateAsync,
    isAddingBalance: addBalanceMutation.isPending,
  };
};

// Hook especializado para transacciones con paginación y filtro de fecha (Respeta regla de no consultas masivas)
export const useDigitalTransactions = (options?: { limit?: number; dateFilter?: 'today' | 'this_week' | 'this_month' | 'all' }) => {
  const { data: userStore } = useUserStore();
  const storeId = userStore?.id;
  const limit = options?.limit || 30;
  const dateFilter = options?.dateFilter || 'today';

  return useQuery<DigitalServiceTransaction[]>({
    queryKey: ['digital-services-transactions', storeId, dateFilter, limit],
    queryFn: async () => {
      if (!storeId) return [];

      let query = supabase
        .from('digital_services_transactions')
        .select('id, store_id, user_id, service_type, carrier, target_number, target_name, amount, amount_charged, commission, client_reference_id, external_id, status, error_message, metadata, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const now = new Date();
      if (dateFilter === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfDay);
      } else if (dateFilter === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', startOfMonth);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching transactions:', error);
        return [];
      }
      return (data || []) as DigitalServiceTransaction[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 20, // 20s
  });
};
