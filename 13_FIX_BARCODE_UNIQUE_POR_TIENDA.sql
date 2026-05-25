-- =====================================================
-- FIX: Cambiar unique constraint global de barcode
-- a unique por tienda (store_id + barcode)
-- =====================================================
-- El error "duplicate key value violates unique constraint products_barcode_key"
-- ocurre porque el barcode existe en OTRO negocio.
-- La solución es hacer único el barcode dentro de CADA tienda.

-- 1. Eliminar el constraint global actual
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS products_barcode_key;

-- 2. Crear un índice parcial único: barcode único DENTRO de cada tienda
--    (ignora NULLs automáticamente)
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_store_unique 
  ON public.products (store_id, barcode) 
  WHERE barcode IS NOT NULL;

-- Verificar que el constraint fue eliminado y el índice creado:
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND indexname IN ('products_barcode_key', 'products_barcode_store_unique');
