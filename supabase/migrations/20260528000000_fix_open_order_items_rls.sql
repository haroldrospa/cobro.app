-- =================================================================
-- CORRECCIÓN DEFINITIVA DE AISLAMIENTO Y RLS PARA PEDIDOS GUARDADOS
-- =================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- Aplica el mismo sistema de aislamiento estricto por tienda (usando get_auth_store_id)
-- que ya se utiliza para ventas, productos, clientes y sesiones de caja.

BEGIN;

-- 1. Habilitar RLS en las tablas si no estuviera ya activo
ALTER TABLE public.open_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_order_items ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas e inconsistentes en open_orders
DROP POLICY IF EXISTS "Store owners can view store orders" ON public.open_orders;
DROP POLICY IF EXISTS "Store owners can update store orders" ON public.open_orders;
DROP POLICY IF EXISTS "Store owners can delete store orders" ON public.open_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.open_orders;
DROP POLICY IF EXISTS "Open orders isolation policy" ON public.open_orders;

-- 3. Eliminar políticas antiguas e inconsistentes en open_order_items
DROP POLICY IF EXISTS "Store owners can view order items" ON public.open_order_items;
DROP POLICY IF EXISTS "Store owners can delete order items" ON public.open_order_items;
DROP POLICY IF EXISTS "Store owners can insert order items" ON public.open_order_items;
DROP POLICY IF EXISTS "Users can insert items into their own orders" ON public.open_order_items;
DROP POLICY IF EXISTS "Insert items for web orders" ON public.open_order_items;
DROP POLICY IF EXISTS "Users can manage open_order_items of their own store" ON public.open_order_items;
DROP POLICY IF EXISTS "Open order items isolation policy" ON public.open_order_items;

-- 4. Crear políticas de aislamiento definitivas basadas en la tienda del usuario
-- Esto permite que tanto el Dueño como los Cajeros (cualquier perfil de la misma tienda)
-- puedan gestionar, ver, cargar y facturar los pedidos guardados.

CREATE POLICY "Open orders isolation policy" 
ON public.open_orders
FOR ALL 
TO authenticated
USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

CREATE POLICY "Open order items isolation policy" 
ON public.open_order_items
FOR ALL 
TO authenticated
USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

COMMIT;
