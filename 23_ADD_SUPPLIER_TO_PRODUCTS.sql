-- MIGRACIÓN 23: AGREGAR COLUMNA 'supplier_id' A LA TABLA 'products'
-- Vincula productos con sus respectivos proveedores

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Índice para mejorar el rendimiento de consultas por proveedor
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

COMMENT ON COLUMN public.products.supplier_id IS 'Proveedor asignado al que se le compra este producto';
