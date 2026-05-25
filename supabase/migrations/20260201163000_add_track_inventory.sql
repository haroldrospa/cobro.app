-- Add track_inventory column to products table
-- When false, the product won't have stock control (useful for services, digital products, etc.)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

-- Update existing products to track inventory by default
UPDATE products SET track_inventory = true WHERE track_inventory IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN products.track_inventory IS 'If true, product has stock control. If false, stock is ignored (for services, digital products, etc.)';
