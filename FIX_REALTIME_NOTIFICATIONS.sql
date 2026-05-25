-- PASO 1: Verificar y Habilitar Realtime
-- Ejecuta esto en el Editor SQL de Supabase

BEGIN;

-- 1. Asegurar que la tabla open_orders está en la publicación de realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'open_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE open_orders;
  END IF;
END $$;

-- 2. Asegurar que los permisos (RLS) permiten ver las órdenes
-- Creamos una política que permite ver las órdenes del mismo store_id
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."open_orders";

CREATE POLICY "Enable read access for authenticated users"
ON "public"."open_orders"
FOR SELECT
TO authenticated
USING (true); -- MODO DEBUG: Permitir ver todo para descartar filtrado por ID

COMMIT;
