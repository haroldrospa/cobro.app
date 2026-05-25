-- Allow store owners (stores.owner_id) to see/manage web orders for their own store

-- 1) Helper: does user own a store?
CREATE OR REPLACE FUNCTION public.owns_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = _store_id
      AND s.owner_id = _user_id
  );
$$;

-- 2) Helper: does this order belong to a store owned by user?
CREATE OR REPLACE FUNCTION public.is_order_in_owned_store(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.open_orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = _order_id
      AND s.owner_id = _user_id
  );
$$;

-- 3) open_orders: store owners can view/update/delete orders for their store
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'open_orders'
      AND policyname = 'Store owners can view store orders'
  ) THEN
    CREATE POLICY "Store owners can view store orders"
    ON public.open_orders
    FOR SELECT
    TO authenticated
    USING (public.owns_store(auth.uid(), store_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'open_orders'
      AND policyname = 'Store owners can update store orders'
  ) THEN
    CREATE POLICY "Store owners can update store orders"
    ON public.open_orders
    FOR UPDATE
    TO authenticated
    USING (public.owns_store(auth.uid(), store_id))
    WITH CHECK (public.owns_store(auth.uid(), store_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'open_orders'
      AND policyname = 'Store owners can delete store orders'
  ) THEN
    CREATE POLICY "Store owners can delete store orders"
    ON public.open_orders
    FOR DELETE
    TO authenticated
    USING (public.owns_store(auth.uid(), store_id));
  END IF;
END $$;

-- 4) open_order_items: store owners can view/delete items for orders in their store
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'open_order_items'
      AND policyname = 'Store owners can view order items'
  ) THEN
    CREATE POLICY "Store owners can view order items"
    ON public.open_order_items
    FOR SELECT
    TO authenticated
    USING (public.is_order_in_owned_store(order_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'open_order_items'
      AND policyname = 'Store owners can delete order items'
  ) THEN
    CREATE POLICY "Store owners can delete order items"
    ON public.open_order_items
    FOR DELETE
    TO authenticated
    USING (public.is_order_in_owned_store(order_id, auth.uid()));
  END IF;
END $$;
