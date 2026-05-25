-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Public can create web orders" ON public.open_orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.open_orders;

-- Create permissive policy for public web orders (no auth required)
CREATE POLICY "Public can create web orders" 
ON public.open_orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (source = 'web' AND profile_id IS NULL);

-- Create permissive policy for authenticated customers to create orders
CREATE POLICY "Customers can create orders" 
ON public.open_orders 
FOR INSERT 
TO authenticated
WITH CHECK (profile_id = auth.uid() OR profile_id IS NULL);

-- Also need to fix open_order_items policies for public web orders
DROP POLICY IF EXISTS "Insert items for own order or web checkout" ON public.open_order_items;

CREATE POLICY "Insert items for web orders" 
ON public.open_order_items 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM open_orders o
    WHERE o.id = open_order_items.order_id
    AND o.source = 'web'
    AND o.profile_id IS NULL
  )
  OR
  EXISTS (
    SELECT 1 FROM open_orders o
    WHERE o.id = open_order_items.order_id
    AND (is_staff_or_admin(auth.uid()) OR o.profile_id = auth.uid())
  )
);