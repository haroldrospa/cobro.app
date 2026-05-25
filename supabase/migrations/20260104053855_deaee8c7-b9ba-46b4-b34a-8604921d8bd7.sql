-- Allow authenticated users to insert items into their own POS orders
CREATE POLICY "Users can insert items into their own orders"
ON public.open_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.open_orders o
    WHERE o.id = open_order_items.order_id
      AND o.profile_id = auth.uid()
  )
);