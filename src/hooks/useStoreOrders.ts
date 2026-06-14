import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

interface StoreOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  subtotal: number;
  total: number;
}

interface CreateStoreOrderData {
  store_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  payment_method: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes?: string;
  items: StoreOrderItem[];
}

export const useCreateStoreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStoreOrderData) => {
      // Generate order number with 'web' prefix
      const { data: orderNumber, error: orderNumberError } = await shopperSupabase
        .rpc('generate_order_number', { order_source: 'web' });

      if (orderNumberError) throw orderNumberError;

      // IMPORTANT: For public (anon) checkout, RLS may block SELECT/RETURNING.
      // We generate the UUID client-side so we don't need to read the inserted row.
      const orderId = crypto.randomUUID();

      // Insert open order with store_id (public web order - no profile_id)
      const { error: orderError } = await shopperSupabase
        .from('open_orders')
        .insert({
          id: orderId,
          order_number: orderNumber,
          store_id: data.store_id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          customer_address: data.customer_address,
          payment_method: data.payment_method,
          subtotal: data.subtotal,
          discount_total: data.discount_total,
          tax_total: data.tax_total,
          total: data.total,
          notes: data.notes,
          source: 'web',
          order_status: 'pending',
          payment_status: 'pending',
          profile_id: null // Public web order
        });

      if (orderError) throw orderError;

      // Insert order items
      const orderItems = data.items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
        subtotal: item.subtotal,
        total: item.total
      }));

      const { error: itemsError } = await shopperSupabase
        .from('open_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { id: orderId, order_number: orderNumber };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      queryClient.invalidateQueries({ queryKey: ['shopper-orders'] });
    }
  });
};
