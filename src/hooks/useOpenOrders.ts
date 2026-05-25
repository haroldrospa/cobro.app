import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OpenOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  subtotal: number;
  total: number;
}

interface CreateOpenOrderData {
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
  items: OpenOrderItem[];
}

export const useCreateOpenOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOpenOrderData) => {
      // Get current user and their store
      const { data: { user } } = await supabase.auth.getUser();

      let storeId = null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('store_id')
          .eq('id', user.id)
          .maybeSingle();
        storeId = profile?.store_id || null;
      }

      // Generate order number with 'web' prefix for web orders
      const { data: orderNumber, error: orderNumberError } = await supabase
        .rpc('generate_order_number', { order_source: 'web' });

      if (orderNumberError) throw orderNumberError;

      // Insert open order with profile_id and store_id
      const { data: order, error: orderError } = await supabase
        .from('open_orders')
        .insert({
          order_number: orderNumber,
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
          order_status: 'preparing',
          payment_status: 'pending',
          profile_id: user?.id || null,
          store_id: storeId
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
        subtotal: item.subtotal,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('open_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
    }
  });
};
