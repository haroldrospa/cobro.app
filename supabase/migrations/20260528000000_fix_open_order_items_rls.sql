-- =====================================================
-- CORRECCIÓN DE RLS PARA DETALLES DE PEDIDOS GUARDADOS
-- =====================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- Permite a los cajeros y personal de la tienda ver y editar los detalles de los pedidos guardados.

BEGIN;

-- 1. Asegurar que las políticas existentes no dupliquen o causen conflictos (opcional, las agregamos)
DROP POLICY IF EXISTS "Users can manage open_order_items of their own store" ON public.open_order_items;

-- 2. Crear la política que permite a cualquier usuario autenticado gestionar los items de su propia tienda
CREATE POLICY "Users can manage open_order_items of their own store"
ON public.open_order_items
FOR ALL
TO authenticated
USING (
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

COMMIT;
