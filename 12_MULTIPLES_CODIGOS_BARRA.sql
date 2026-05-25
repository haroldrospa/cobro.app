-- =====================================================
-- MÚLTIPLES CÓDIGOS DE BARRA POR PRODUCTO
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Crear tabla de códigos de barra adicionales
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  label TEXT, -- etiqueta opcional: "marca A", "caja", etc.
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, barcode)  -- no duplicados por producto
);

-- 2. Índices para búsqueda rápida por código de barra
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON public.product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_store_id ON public.product_barcodes(store_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

-- Política: los usuarios solo ven barcodes de su tienda
CREATE POLICY "Users can view their store product barcodes"
  ON public.product_barcodes FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product barcodes for their store"
  ON public.product_barcodes FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update product barcodes for their store"
  ON public.product_barcodes FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product barcodes for their store"
  ON public.product_barcodes FOR DELETE
  USING (
    store_id IN (
      SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. Función RPC para buscar producto por cualquier código de barra
CREATE OR REPLACE FUNCTION public.find_product_by_barcode(
  p_barcode TEXT,
  p_store_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Primero buscar en el campo barcode principal del producto
  SELECT id INTO v_product_id
  FROM public.products
  WHERE barcode = p_barcode AND store_id = p_store_id
  LIMIT 1;

  -- Si no encontró, buscar en la tabla de códigos adicionales
  IF v_product_id IS NULL THEN
    SELECT product_id INTO v_product_id
    FROM public.product_barcodes
    WHERE barcode = p_barcode AND store_id = p_store_id
    LIMIT 1;
  END IF;

  RETURN v_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Comentarios
COMMENT ON TABLE public.product_barcodes IS 'Códigos de barra adicionales por producto (un producto puede tener varios)';
COMMENT ON COLUMN public.product_barcodes.barcode IS 'Código de barra adicional';
COMMENT ON COLUMN public.product_barcodes.label IS 'Etiqueta descriptiva opcional (ej: "Caja de 6", "Presentación grande")';
