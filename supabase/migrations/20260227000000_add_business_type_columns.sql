-- Add business type and module toggle columns to store_settings table
-- These columns control which pages/features appear in the navigation

ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS shop_type VARCHAR DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS use_delivery BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS use_kitchen BOOLEAN DEFAULT true;

-- Idempotent safety block
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'shop_type') THEN
        ALTER TABLE store_settings ADD COLUMN shop_type VARCHAR DEFAULT 'restaurant';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'use_delivery') THEN
        ALTER TABLE store_settings ADD COLUMN use_delivery BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'use_kitchen') THEN
        ALTER TABLE store_settings ADD COLUMN use_kitchen BOOLEAN DEFAULT true;
    END IF;
END $$;
