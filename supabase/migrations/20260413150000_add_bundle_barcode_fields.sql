-- Add bundle fields to product_barcodes
ALTER TABLE product_barcodes 
ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed'));

-- Update existing records to ensure they have default values (redundant but safe)
UPDATE product_barcodes SET quantity = 1 WHERE quantity IS NULL;
UPDATE product_barcodes SET discount_value = 0 WHERE discount_value IS NULL;
UPDATE product_barcodes SET discount_type = 'percentage' WHERE discount_type IS NULL;
