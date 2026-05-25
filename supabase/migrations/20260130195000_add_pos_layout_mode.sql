-- Add pos_layout_mode to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS pos_layout_mode TEXT DEFAULT 'catalog';

-- Comment on column
COMMENT ON COLUMN public.store_settings.pos_layout_mode IS 'Preferred layout mode for POS: catalog (modern) or classic (search-focused)';
