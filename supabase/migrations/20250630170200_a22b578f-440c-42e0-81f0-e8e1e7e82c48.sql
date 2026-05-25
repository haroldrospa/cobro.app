
-- Agregar la columna cost_includes_tax a la tabla products
ALTER TABLE public.products 
ADD COLUMN cost_includes_tax BOOLEAN DEFAULT false;
