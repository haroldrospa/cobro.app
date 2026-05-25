-- Add logo_margin_top column to store_settings for print customization
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS logo_margin_top TEXT DEFAULT '6px';

-- Comment explaining the column
COMMENT ON COLUMN store_settings.logo_margin_top IS 'Top margin spacing for company logo on printed invoices';
