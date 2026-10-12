-- Expand open_orders_source_check constraint to allow 'pedidosya' source
ALTER TABLE public.open_orders DROP CONSTRAINT IF EXISTS open_orders_source_check;
ALTER TABLE public.open_orders ADD CONSTRAINT open_orders_source_check CHECK (source IN ('pos', 'web', 'pedidosya'));
