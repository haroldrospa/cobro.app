-- Add new columns for invoice print settings to store_settings table
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS invoice_font_size INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS show_barcode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS logo_width VARCHAR DEFAULT 'auto';

-- Function to ensure these columns exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'invoice_font_size') THEN
        ALTER TABLE store_settings ADD COLUMN invoice_font_size INTEGER DEFAULT 12;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'show_barcode') THEN
        ALTER TABLE store_settings ADD COLUMN show_barcode BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'logo_width') THEN
        ALTER TABLE store_settings ADD COLUMN logo_width VARCHAR DEFAULT 'auto';
    END IF;
END $$;
