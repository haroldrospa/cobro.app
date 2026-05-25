-- Add policy for store owners to insert order items
CREATE POLICY "Store owners can insert order items"
ON public.open_order_items
FOR INSERT
WITH CHECK (is_order_in_owned_store(order_id, auth.uid()));