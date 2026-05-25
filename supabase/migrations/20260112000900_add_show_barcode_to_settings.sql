-- Add show_barcode column to store_settings
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS show_barcode BOOLEAN DEFAULT false;

-- Comment explaining the column
COMMENT ON COLUMN store_settings.show_barcode IS 'Show NCF barcode on printed invoices';
