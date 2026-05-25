-- Migración para soportar cantidades y stock en formato decimal (e.g. 1.5, 2.75)

-- Modificar la tabla de productos para soportar stock en decimales
ALTER TABLE public.products 
ALTER COLUMN stock TYPE DECIMAL(10,3) USING stock::numeric,
ALTER COLUMN min_stock TYPE DECIMAL(10,3) USING min_stock::numeric;

-- Modificar la tabla de elementos de venta (POS) para soportar cantidades decimales
ALTER TABLE public.sale_items 
ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::numeric;

-- Modificar la tabla de elementos de órdenes abiertas (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'open_order_items'
    AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.open_order_items 
    ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::numeric;
  END IF;
END $$;

-- Modificar la tabla product_offers (si existe) eliminando primero el check e insertándolo de nuevo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_offers'
  ) THEN
    -- Intentar cambiar el tipo a decimal
    ALTER TABLE public.product_offers 
    ALTER COLUMN quantity TYPE DECIMAL(10,3) USING quantity::numeric;
  END IF;
END $$;
