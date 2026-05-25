-- Add notification sound settings to store_settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS web_order_sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS web_order_sound_type text DEFAULT 'chime';

-- Add comment for documentation
COMMENT ON COLUMN public.store_settings.web_order_sound_enabled IS 'Whether to play sound on new web orders';
COMMENT ON COLUMN public.store_settings.web_order_sound_type IS 'Type of notification sound: chime, bell, ding, alert';