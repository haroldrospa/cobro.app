import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useUserStore } from './useUserStore';

export interface Sale {
  id: string;
  invoice_number: string;
  user_id?: string;
  profile_id?: string;
  profile?: {
    full_name?: string;
    email?: string;
    role?: string;
    user_number?: string;
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
  includeItems?: boolean;
}

export const useSales = (filters: SalesFilters = {}) => {
  const { data: userStore } = useUserStore();

  return useQuery({
    queryKey: ['sales', userStore?.id, filters],
    queryFn: async () => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const activeStoreId = userStore?.id || profile?.store_id;

      let selectFields = `
        *,
        customer:customers(name, rnc, phone, email),
        profile:profiles(full_name, email, role, user_number),
        invoice_type:invoice_types(name, code)
      `;

      if (filters.includeItems !== false) {
        selectFields += `,
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
        `;
      }

      let query = supabase
        .from('sales')
        .select(selectFields)
        .order('created_at', { ascending: false });

      // Filter by store_id
      if (activeStoreId) {
        query = query.eq('store_id', activeStoreId);
      }

      // Filtro de búsqueda por texto
      let isInvoiceSearch = false;

      if (filters.searchTerm) {
        const term = filters.searchTerm.trim();
        const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');

        // Detect if searching for invoice/NCF (starts with B, E, INV or contains digits)
        isInvoiceSearch = Boolean(term && (
          /^[bBeE][0-9-]+/i.test(term) ||
          term.toUpperCase().startsWith('INV') ||
          /^[bBeE]?[0-9]{2,}/i.test(cleanTerm)
        ));

        const hyphenWildcardTerm = term.replace(/-/g, '%');

        let formattedWildcardTerm = cleanTerm;
        if (cleanTerm.length > 3) {
          formattedWildcardTerm = cleanTerm.slice(0, 3) + '%' + cleanTerm.slice(3);
        }

        let numericOnlyTerm = cleanTerm.replace(/^[a-zA-Z]+/, '');

        // Match customers by name, rnc or phone
        const { data: matchingCustomers } = await supabase
          .from('customers')
          .select('id')
          .or(`name.ilike.%${term}%,rnc.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(100);

        const customerIds = matchingCustomers?.map(c => c.id) ?? [];

        const conditions: string[] = [
          `invoice_number.ilike.%${term}%`,
          `invoice_number.ilike.%${cleanTerm}%`,
          `invoice_number.ilike.%${hyphenWildcardTerm}%`,
          `invoice_number.ilike.%${formattedWildcardTerm}%`
        ];

        if (numericOnlyTerm && numericOnlyTerm.length > 2) {
          conditions.push(`invoice_number.ilike.%${numericOnlyTerm}%`);
        }

        if (customerIds.length > 0) {
          customerIds.forEach(id => conditions.push(`customer_id.eq.${id}`));
        }

        query = query.or(conditions.join(','));
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

      // Filtro por tipo de factura (Mapea códigos B01, B02, B14, etc. a su UUID correspondiente)
      if (filters.invoiceTypeId && filters.invoiceTypeId !== 'all') {
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(filters.invoiceTypeId);
        if (isUUID) {
          query = query.eq('invoice_type_id', filters.invoiceTypeId);
        } else {
          const { data: invType } = await supabase
            .from('invoice_types')
            .select('id')
            .eq('code', filters.invoiceTypeId.toUpperCase())
            .maybeSingle();

          if (invType?.id) {
            query = query.eq('invoice_type_id', invType.id);
          }
        }
      }

      // Filtro por fecha desde (Only if NOT searching for a specific invoice)
      if (filters.dateFrom instanceof Date && !isNaN(filters.dateFrom.getTime()) && !isInvoiceSearch) {
        const bufferDateFrom = new Date(filters.dateFrom);
        bufferDateFrom.setHours(bufferDateFrom.getHours() - 12); // Buffer para absorber desincronización de reloj local vs server
        query = query.gte('created_at', bufferDateFrom.toISOString());
      }

      // Filtro por fecha hasta (Only if NOT searching for a specific invoice)
      if (filters.dateTo instanceof Date && !isNaN(filters.dateTo.getTime()) && !isInvoiceSearch) {
        const dateToAdjusted = new Date(filters.dateTo);
        dateToAdjusted.setHours(23, 59, 59, 999);
        dateToAdjusted.setHours(dateToAdjusted.getHours() + 12); // Buffer para zona horaria local vs server
        query = query.lte('created_at', dateToAdjusted.toISOString());
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
    refetchInterval: false, // Egress Optimization: Stop aggressive polling
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
    profile: localSale.profile || undefined,
    profile_id: localSale.profile_id,
    user_id: localSale.user_id,
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
            profile:profiles(full_name, email, role, user_number),
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

        // Fallback if profile not joined directly (e.g. legacy sales referencing user_id or without foreign key match)
        if (data && !data.profile && (data.profile_id || (data as any).user_id)) {
          const fallbackProfileId = data.profile_id || (data as any).user_id;
          try {
            const { data: profData } = await supabase
              .from('profiles')
              .select('full_name, email, role, user_number')
              .eq('id', fallbackProfileId)
              .maybeSingle();
            if (profData) {
              data.profile = profData;
            }
          } catch (e) {
            console.warn('Fallback profile fetch error:', e);
          }
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
      payment_status?: string;
      due_date?: string | null;
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
