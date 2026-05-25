import { useQuery } from '@tanstack/react-query';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';
import { Product } from './useProducts';

export const useStoreProducts = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['products', 'store', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      let allData: any[] = [];
      let hasMore = true;
      let from = 0;
      const step = 1000;
      let fetchError = null;

      while (hasMore) {
        const { data: chunk, error: chunkError } = await shopperSupabase
          .from('products')
          .select(`
            *,
            category:categories(name)
          `)
          .eq('store_id', storeId)
          .eq('status', 'active')
          .order('name')
          .range(from, from + step - 1);

        if (chunkError) {
          fetchError = chunkError;
          break;
        }

        if (chunk && chunk.length > 0) {
          allData = [...allData, ...chunk];
          from += step;
          if (chunk.length < step) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (fetchError) throw fetchError;
      const data = allData;

      // Filter out products that are explicitly hidden from store
      // We check for !== false so that null/undefined (legacy records) default to visible
      return (data as Product[]).filter(p => p.is_visible_in_store !== false);
    },
    enabled: !!storeId,
  });
};
