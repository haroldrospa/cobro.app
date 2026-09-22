-- MIGRACIÓN 24: AGREGAR COLUMNA 'supplier_id' A LA TABLA 'restaurant_ingredients'
-- Vincula ingredientes de restaurante con sus respectivos proveedores

ALTER TABLE public.restaurant_ingredients 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Índice para mejorar el rendimiento de consultas por proveedor
CREATE INDEX IF NOT EXISTS idx_restaurant_ingredients_supplier_id 
ON public.restaurant_ingredients(supplier_id);

COMMENT ON COLUMN public.restaurant_ingredients.supplier_id IS 'Proveedor asignado al que se le compra este ingrediente';
