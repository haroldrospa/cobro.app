-- Add cost_includes_tax column to open_order_items table
ALTER TABLE public.open_order_items 
ADD COLUMN IF NOT EXISTS cost_includes_tax BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.open_order_items.cost_includes_tax IS 'Whether the unit_price includes tax or not';
