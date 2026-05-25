-- Fix RLS so anon/public web checkout can insert open_order_items for web orders (profile_id IS NULL)

-- 1) Helper SECURITY DEFINER function (bypasses RLS on open_orders during policy evaluation)
CREATE OR REPLACE FUNCTION public.is_public_web_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.open_orders o
    WHERE o.id = _order_id
      AND o.source = 'web'
      AND o.profile_id IS NULL
  );
$$;

-- 2) Replace the INSERT policy that currently fails because it relies on reading open_orders under anon RLS
DROP POLICY IF EXISTS "Insert items for web orders" ON public.open_order_items;

CREATE POLICY "Insert items for web orders"
ON public.open_order_items
FOR INSERT
TO anon
WITH CHECK (
  public.is_public_web_order(order_id)
);
