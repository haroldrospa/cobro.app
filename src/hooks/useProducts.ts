import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductBarcode {
  id: string;
  barcode: string;
  label?: string;
  quantity: number;
  discount_value: number;
  discount_type: 'percentage' | 'fixed';
}

export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  cost_includes_tax?: boolean;
  tax_percentage?: number;
  internal_code?: string;
  barcode?: string;
  barcodes?: ProductBarcode[]; // múltiples códigos de barra adicionales
  category_id?: string;
  stock: number;
  min_stock: number;
  status: 'active' | 'inactive' | 'low_stock';
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  discount_percentage?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  is_featured?: boolean;
  category?: {
    name: string;
  };
  is_variable_price?: boolean;
  is_variable_quantity?: boolean;
  is_visible_in_store?: boolean;
  track_inventory?: boolean;
}

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const storeId = profile?.store_id;

      let allData: any[] = [];
      let isBasicSchema = false;
      let hasMore = true;
      let from = 0;
      const step = 1000;
      let fetchError = null;

      while (hasMore) {
        let query = supabase
          .from('products')
          .select(isBasicSchema ? `
            id, name, price, stock, cost, barcode, internal_code, min_stock, status, image_url, tax_percentage, cost_includes_tax, discount_percentage, discount_start_date, discount_end_date, is_featured, is_variable_price, is_variable_quantity, store_id, category_id, created_at, updated_at, category:categories(name), barcodes:product_barcodes(id, barcode, label)
          ` : `
            *,
            category:categories(name),
            barcodes:product_barcodes(id, barcode, label, quantity, discount_value, discount_type)
          `)
          .order('name')
          .range(from, from + step - 1);

        if (storeId) query = query.eq('store_id', storeId);

        const { data: chunk, error: chunkError } = await query;

        if (chunkError && chunkError.message?.includes('Could not find') && !isBasicSchema) {
          console.warn('Some columns missing in DB, fetching with basic schema');
          isBasicSchema = true;
          continue; // Retry same chunk with basic schema
        }

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

      const data = allData;
      const error = fetchError;

      if (error) {
        if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
          console.warn("Network error fetching products (offline mode)");
          return [];
        }
        console.error('Error loading products:', error);
        throw error;
      }

      return (data || []) as Product[];
    },
    staleTime: 1000 * 60 * 2,    // 2 min
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: true,        // Siempre refetchear al montar si está stale
    refetchOnWindowFocus: true,  // Refetchear al volver a la pestaña
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      price: number;
      cost?: number;
      cost_includes_tax?: boolean;
      tax_percentage?: number;
      internal_code?: string;
      barcode?: string;
      category_id?: string | null;
      stock: number;
      min_stock: number;
      status: 'active' | 'inactive';
      image_url?: string;
      discount_percentage?: number;
      discount_start_date?: string | null;
      discount_end_date?: string | null;
      is_featured?: boolean;
      is_variable_price?: boolean;
      is_variable_quantity?: boolean;
      is_visible_in_store?: boolean;
      track_inventory?: boolean;
    }) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      let storeId: string | null = null;

      // 1. Try to get from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.store_id) {
        storeId = profile.store_id;
      } else {
        // 2. Fallback: Try to get from stores table where owner_id = user.id
        const { data: store } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (store?.id) {
          storeId = store.id;
        }
      }

      if (!storeId) {
        throw new Error('No se encontró una tienda activa para este usuario.');
      }

      // Try inserting with all fields first
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...product,
          store_id: storeId,
        }])
        .select()
        .single();

      if (error) {
        // Fallback: If column doesn't exist yet, retry without it
        if (error.message?.includes('Could not find')) {
          // Check which columns are missing
          const missingColumns = [];
          if (error.message.includes('is_visible_in_store')) missingColumns.push('is_visible_in_store');
          if (error.message.includes('track_inventory')) missingColumns.push('track_inventory');
          if (error.message.includes('is_variable_quantity')) missingColumns.push('is_variable_quantity');

          if (missingColumns.length > 0) {
            console.warn(`Missing columns in DB: ${missingColumns.join(', ')}. Saving without these fields.`);

            // Remove missing columns from product
            let safeProduct = { ...product };
            missingColumns.forEach(col => {
              delete (safeProduct as any)[col];
            });

            const { data: retryData, error: retryError } = await supabase
              .from('products')
              .insert([{
                ...safeProduct,
                store_id: storeId,
              }])
              .select()
              .single();

            if (retryError) throw retryError;
            return retryData;
          }
        }
        console.error('Supabase error creating product:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...product }: {
      id: string;
      name: string;
      price: number;
      cost?: number;
      cost_includes_tax?: boolean;
      tax_percentage?: number;
      internal_code?: string;
      barcode?: string;
      category_id?: string | null;
      stock: number;
      min_stock: number;
      status: 'active' | 'inactive';
      image_url?: string;
      discount_percentage?: number;
      discount_start_date?: string | null;
      discount_end_date?: string | null;
      is_featured?: boolean;
      is_variable_price?: boolean;
      is_variable_quantity?: boolean;
      is_visible_in_store?: boolean;
      track_inventory?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        // Fallback: If column doesn't exist yet, retry without it
        if (error.message?.includes('Could not find')) {
          // Check which columns are missing
          const missingColumns = [];
          if (error.message.includes('is_visible_in_store')) missingColumns.push('is_visible_in_store');
          if (error.message.includes('track_inventory')) missingColumns.push('track_inventory');
          if (error.message.includes('is_variable_quantity')) missingColumns.push('is_variable_quantity');

          if (missingColumns.length > 0) {
            console.warn(`Missing columns in DB: ${missingColumns.join(', ')}. Updating without these fields.`);

            // Remove missing columns from product
            let safeProduct = { ...product };
            missingColumns.forEach(col => {
              delete (safeProduct as any)[col];
            });

            const { data: retryData, error: retryError } = await supabase
              .from('products')
              .update(safeProduct)
              .eq('id', id)
              .select()
              .single();

            if (retryError) throw retryError;
            return retryData;
          }
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Usar RPC para saltar políticas RLS (Security Definer) y forzar la desvinculación
      const { error: rpcError } = await supabase.rpc('delete_product_cascade' as any, {
        target_product_id: id
      });

      if (rpcError) {
        if (rpcError.message.includes('Could not find') || rpcError.message.includes('function delete_product_cascade')) {
          throw new Error('FALTA_SQL');
        }
        throw rpcError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteAllProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.store_id) throw new Error('No se encontró la tienda');

      // First, get all product IDs for this store to delete them explicitly
      // This sometimes bypasses issues where bulk delete is restricted
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', profile.store_id);

      if (!products || products.length === 0) return;

      const ids = products.map(p => p.id);

      // Desvincular de ventas e items abiertos en lote para evitar errores
      for (const id of ids) {
        const { error: rpcError } = await supabase.rpc('delete_product_cascade' as any, {
          target_product_id: id
        });
        if (rpcError) {
          if (rpcError.message.includes('Could not find') || rpcError.message.includes('function delete_product_cascade')) {
            throw new Error('FALTA_SQL');
          }
          console.error("Error deleting product cascade", id, rpcError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
