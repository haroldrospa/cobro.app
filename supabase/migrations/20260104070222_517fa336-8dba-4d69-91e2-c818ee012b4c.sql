-- Add volume setting for web order notification sounds
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS web_order_sound_volume numeric DEFAULT 0.7;