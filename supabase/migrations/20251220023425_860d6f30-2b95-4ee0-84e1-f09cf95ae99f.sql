-- Fix INSERT policy for open_order_items to allow POS saved orders by the order owner (authenticated user)
DROP POLICY IF EXISTS "Staff can insert order items" ON public.open_order_items;

CREATE POLICY "Insert items for own order or web checkout"
ON public.open_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.open_orders o
    WHERE o.id = open_order_items.order_id
      AND (
        -- Staff/admin can always insert
        public.is_staff_or_admin(auth.uid())
        OR
        -- Public web checkout (web orders have profile_id NULL)
        (o.source = 'web' AND o.profile_id IS NULL)
        OR
        -- POS saved order: allow the authenticated user who created the order
        (o.profile_id = auth.uid())
      )
  )
);