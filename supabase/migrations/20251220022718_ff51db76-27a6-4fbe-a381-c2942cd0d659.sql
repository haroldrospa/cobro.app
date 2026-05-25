-- Drop the existing restrictive INSERT policy for open_order_items
DROP POLICY IF EXISTS "Public can insert order items" ON public.open_order_items;

-- Create a new policy that allows inserting order items for both web orders and POS orders (via staff)
CREATE POLICY "Staff can insert order items" 
ON public.open_order_items 
FOR INSERT 
WITH CHECK (
  is_staff_or_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM open_orders 
    WHERE open_orders.id = open_order_items.order_id 
    AND open_orders.source = 'web'
  )
);