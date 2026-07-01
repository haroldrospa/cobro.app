import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';

export const useWebOrdersCount = () => {
  const { data: userStore } = useUserStore();

  return useQuery({
    queryKey: ['web-orders-count', userStore?.id],
    queryFn: async () => {
      const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      if (!isUUID(userStore?.id)) {
        return 0;
      }

      const { count, error } = await supabase
        .from('open_orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', userStore.id)
        .ilike('source', 'web')
        .in('order_status', ['pending', 'confirmed', 'preparing', 'shipped']);

      if (error) {
        if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
          return 0;
        }
        console.error('Error fetching web orders count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!userStore?.id,
    refetchInterval: false, // Egress Optimization: Disabled 5s polling, rely on Supabase Realtime
    refetchOnWindowFocus: true,
  });
};
