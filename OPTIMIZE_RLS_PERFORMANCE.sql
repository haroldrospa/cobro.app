-- =========================================================================
-- OPTIMIZACIÓN DE RENDIMIENTO RLS (ROW LEVEL SECURITY)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- =========================================================================

-- 1. Redefinir public.get_auth_store_id como STABLE y LANGUAGE SQL
-- Al ser STABLE, PostgreSQL evalúa esta función UNA SOLA VEZ por consulta
-- en lugar de una vez por cada fila, mejorando el rendimiento hasta 1000x.
CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Redefinir public.get_auth_role como STABLE y LANGUAGE SQL
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 3. Redefinir public.is_admin_of_store_secure como STABLE y LANGUAGE SQL
CREATE OR REPLACE FUNCTION public.is_admin_of_store_secure(lookup_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_store_id() = lookup_store_id AND public.get_auth_role() IN ('admin', 'manager');
$$;

-- 4. Optimizar las políticas de product_barcodes para evitar subconsultas redundantes
-- Usamos la función optimizada get_auth_store_id() en lugar de subconsultas directas.
DROP POLICY IF EXISTS "Users can view their store product barcodes" ON public.product_barcodes;
CREATE POLICY "Users can view their store product barcodes"
  ON public.product_barcodes FOR SELECT
  TO authenticated
  USING (store_id = public.get_auth_store_id());

DROP POLICY IF EXISTS "Users can insert product barcodes for their store" ON public.product_barcodes;
CREATE POLICY "Users can insert product barcodes for their store"
  ON public.product_barcodes FOR INSERT
  TO authenticated
  WITH CHECK (store_id = public.get_auth_store_id());

DROP POLICY IF EXISTS "Users can update product barcodes for their store" ON public.product_barcodes;
CREATE POLICY "Users can update product barcodes for their store"
  ON public.product_barcodes FOR UPDATE
  TO authenticated
  USING (store_id = public.get_auth_store_id());

DROP POLICY IF EXISTS "Users can delete product barcodes for their store" ON public.product_barcodes;
CREATE POLICY "Users can delete product barcodes for their store"
  ON public.product_barcodes FOR DELETE
  TO authenticated
  USING (store_id = public.get_auth_store_id());

-- 5. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_auth_store_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_store_id TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of_store_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_store_secure TO service_role;

-- 6. Mensaje de éxito
SELECT 'RLS Performance Optimization Script Applied' as result;
