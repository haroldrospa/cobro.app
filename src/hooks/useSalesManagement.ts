import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';

export interface Sale {
  id: string;
  invoice_number: string;
  user_id?: string;
  profile_id?: string;
  profile?: {
    full_name: string;
  };
  customer_id?: string;
  customer?: {
    name: string;
    rnc?: string;
    phone?: string;
    email?: string;
  };
  invoice_type_id?: string;
  invoice_type?: {
    name: string;
    code: string;
  };
  subtotal: number;
  discount_total?: number;
  tax_total: number;
  total: number;
  payment_method: string;
  amount_received?: number;
  change_amount?: number;
  status: string;
  payment_status?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  sale_items?: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_percentage?: number;
    tax_percentage: number;
    subtotal: number;
    discount_amount?: number;
    tax_amount: number;
    total: number;
    product?: {
      name: string;
      image_url?: string | null;
    };
  }[];
}

export interface SalesFilters {
  searchTerm?: string;
  status?: string;
  paymentMethod?: string;
  customerId?: string;
  invoiceTypeId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export const useSales = (filters: SalesFilters = {}) => {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: async () => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      let query = supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, rnc, phone, email),
          profile:profiles(full_name),
          invoice_type:invoice_types(name, code),
          sale_items:sale_items(
            id,
            product_id,
            quantity,
            unit_price,
            discount_percentage,
            tax_percentage,
            subtotal,
            discount_amount,
            tax_amount,
            total,
            product:products(name, image_url)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by store_id
      if (profile?.store_id) {
        query = query.eq('store_id', profile.store_id);
      }

      // Filtro de búsqueda por texto
      let isInvoiceSearch = false;

      if (filters.searchTerm) {
        const term = filters.searchTerm.trim();
        // Check if search term looks like an invoice (starts with B)
        isInvoiceSearch = /^[bB][0-9-]+/.test(term);

        if (isInvoiceSearch) {
          const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
          const hyphenWildcardTerm = term.replace(/-/g, '%');

          // Construct a term that inserts a wildcard after the 3-character prefix (e.g. B02)
          // This handles cases where user types "B020000192" but DB has "B02-0000192"
          let formattedWildcardTerm = cleanTerm;
          if (cleanTerm.length > 3) {
            formattedWildcardTerm = cleanTerm.slice(0, 3) + '%' + cleanTerm.slice(3);
          }

          // Invoice specific search - Exclude customer name to strictly find the invoice
          // Searching: 
          // 1. Exact term (B02-0000...)
          // 2. Clean term (B020000...)
          // 3. Hyphen wildcard from input (B02%0000...)
          // 4. Formatted wildcard (B02%... inserted automatically)
          query = query.or(`invoice_number.ilike.%${term}%,invoice_number.ilike.%${cleanTerm}%,invoice_number.ilike.%${hyphenWildcardTerm}%,invoice_number.ilike.%${formattedWildcardTerm}%`);
        } else {
          // Standard search (Customer name or Invoice number)
          query = query.or(`invoice_number.ilike.%${term}%,customer.name.ilike.%${term}%`);
        }
      }

      // Filtro por estado
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filtro por método de pago
      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      // Filtro por cliente
      if (filters.customerId && filters.customerId !== 'all') {
        if (filters.customerId === 'general') {
          query = query.is('customer_id', null);
        } else {
          query = query.eq('customer_id', filters.customerId);
        }
      }

      // Filtro por usuario (empleado)
      if (filters.userId && filters.userId !== 'all') {
        query = query.eq('profile_id', filters.userId);
      }

      // Filtro por tipo de factura
      if (filters.invoiceTypeId && filters.invoiceTypeId !== 'all') {
        query = query.eq('invoice_type_id', filters.invoiceTypeId);
      }

      // Filtro por fecha desde (Only if NOT searching for a specific invoice)
      if (filters.dateFrom instanceof Date && !isNaN(filters.dateFrom.getTime()) && !isInvoiceSearch) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      // Filtro por fecha hasta (Only if NOT searching for a specific invoice)
      if (filters.dateTo instanceof Date && !isNaN(filters.dateTo.getTime()) && !isInvoiceSearch) {
        // Add 1 day to include the end date fully
        const dateToAdjusted = new Date(filters.dateTo);
        dateToAdjusted.setDate(dateToAdjusted.getDate() + 1);
        query = query.lt('created_at', dateToAdjusted.toISOString());
      }

      // Filtro por monto mínimo
      if (filters.minAmount !== undefined && filters.minAmount > 0) {
        query = query.gte('total', filters.minAmount);
      }

      // Filtro por monto máximo
      if (filters.maxAmount !== undefined && filters.maxAmount > 0) {
        query = query.lte('total', filters.maxAmount);
      }

      // Fetch all matching records using pagination to avoid silent truncation on busy days
      const allSales: Sale[] = [];
      let from = 0;
      const pageSize = 500;

      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);

        if (error) {
          console.error('Error fetching sales:', error);
          throw error;
        }

        if (!data || data.length === 0) break;
        
        allSales.push(...(data as Sale[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allSales;
    },
    staleTime: 1000 * 30, // 30 seconds - refresh often so new sales appear quickly
    refetchOnWindowFocus: true, // Refetch when switching back to the tab
    refetchInterval: 1000 * 30, // Poll every 30 seconds as fallback
  });
};

// Helper to map local sale to Sale interface
async function mapLocalSaleToSale(localSale: any): Promise<Sale> {
  const mappedItems = (localSale.items || []).map((item: any) => {
    const taxRate = item.tax || 0.18;
    const itemSubtotal = item.price * item.quantity;
    
    const discountPercent = item.discount_percentage || 0;
    const discountAmount = (discountPercent / 100) * itemSubtotal;
    const subtotalAfterDiscount = itemSubtotal - discountAmount;
    
    let taxAmount, total;
    if (item.cost_includes_tax) {
      total = subtotalAfterDiscount;
      const baseNet = total / (1 + taxRate);
      taxAmount = total - baseNet;
    } else {
      taxAmount = subtotalAfterDiscount * taxRate;
      total = subtotalAfterDiscount + taxAmount;
    }

    return {
      id: item.id || crypto.randomUUID(),
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      discount_percentage: discountPercent,
      tax_percentage: taxRate * 100,
      subtotal: itemSubtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total: total,
      product: {
        name: item.name || 'Producto',
        image_url: item.image_url || null
      }
    };
  });

  return {
    id: localSale.id,
    invoice_number: localSale.invoice_number,
    subtotal: localSale.subtotal,
    discount_total: localSale.discount_total,
    tax_total: localSale.tax_total,
    total: localSale.total,
    payment_method: localSale.payment_method,
    amount_received: localSale.amount_received,
    change_amount: localSale.change_amount,
    status: localSale.status || 'completed',
    payment_status: localSale.payment_status || 'paid',
    due_date: localSale.due_date,
    created_at: localSale.created_at,
    updated_at: localSale.updated_at || localSale.created_at,
    sale_items: mappedItems,
    customer: localSale.customer || undefined,
    invoice_type: localSale.invoice_type || undefined,
  };
}

export const useSaleDetails = (saleId: string) => {
  return useQuery({
    queryKey: ['sale-details', saleId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select(`
            *,
            customer:customers(name, rnc, phone, email),
            invoice_type:invoice_types(name, code),
            sale_items:sale_items(
              id,
              product_id,
              quantity,
              unit_price,
              discount_percentage,
              tax_percentage,
              subtotal,
              discount_amount,
              tax_amount,
              total,
              product:products(name, image_url)
            )
          `)
          .eq('id', saleId)
          .single();

        if (error) {
          console.warn('Supabase fetch details error, trying local DB:', error);
          const localSale = await offlineDB.get<any>(OfflineStore.SALES, saleId);
          if (localSale) {
            let customerData = undefined;
            if (localSale.customer_id) {
              customerData = await offlineDB.get<any>(OfflineStore.CUSTOMERS, localSale.customer_id);
            }
            let invoiceTypeData = undefined;
            if (localSale.invoice_type_id) {
              invoiceTypeData = await offlineDB.get<any>(OfflineStore.INVOICE_TYPES, localSale.invoice_type_id);
            }
            return await mapLocalSaleToSale({
              ...localSale,
              customer: customerData,
              invoice_type: invoiceTypeData
            });
          }
          throw error;
        }

        return data as Sale;
      } catch (err) {
        console.warn('Error fetching online sale details, trying offline:', err);
        const localSale = await offlineDB.get<any>(OfflineStore.SALES, saleId);
        if (localSale) {
          let customerData = undefined;
          if (localSale.customer_id) {
            customerData = await offlineDB.get<any>(OfflineStore.CUSTOMERS, localSale.customer_id);
          }
          let invoiceTypeData = undefined;
          if (localSale.invoice_type_id) {
            invoiceTypeData = await offlineDB.get<any>(OfflineStore.INVOICE_TYPES, localSale.invoice_type_id);
          }
          return await mapLocalSaleToSale({
            ...localSale,
            customer: customerData,
            invoice_type: invoiceTypeData
          });
        }
        throw err;
      }
    },
    enabled: !!saleId,
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      customer_id?: string | null;
      payment_method?: string;
      status?: string;
      amount_received?: number;
      change_amount?: number;
    }) => {
      // Limpiar datos undefined
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      const { data, error } = await supabase
        .from('sales')
        .update(cleanUpdates)
        .eq('id', id)
        .select(`
          *,
          customer:customers(name, rnc, phone, email),
          invoice_type:invoice_types(name, code)
        `)
        .single();

      if (error) {
        console.error('Error updating sale:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-details'] });
    },
  });
};

export const useDeleteSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      // Primero eliminar los items de la venta
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      // Luego eliminar la venta
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
};
