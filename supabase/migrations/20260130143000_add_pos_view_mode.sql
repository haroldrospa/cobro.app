-- Add pos_view_mode to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS pos_view_mode TEXT DEFAULT 'grid';

-- Comment on column
COMMENT ON COLUMN public.store_settings.pos_view_mode IS 'Preferred view mode for POS products: grid or list';
