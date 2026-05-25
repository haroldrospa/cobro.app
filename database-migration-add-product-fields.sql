-- Migration: Add is_visible_in_store and track_inventory columns to products table
-- Run this SQL script in your Supabase SQL Editor

-- Add is_visible_in_store column (default TRUE - visible by default)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_visible_in_store BOOLEAN DEFAULT TRUE;

-- Add track_inventory column (default NULL for backwards compatibility)
-- NULL means we'll infer from stock/min_stock values
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT NULL;

-- Update existing products to set track_inventory based on current behavior
-- If stock or min_stock is set, assume we're tracking inventory
UPDATE products 
SET track_inventory = TRUE 
WHERE track_inventory IS NULL AND (stock IS NOT NULL OR min_stock IS NOT NULL);

-- For products with no stock info, default to not tracking
UPDATE products 
SET track_inventory = FALSE 
WHERE track_inventory IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN products.is_visible_in_store IS 'Whether this product is visible in the public store (Mi Tienda)';
COMMENT ON COLUMN products.track_inventory IS 'Whether to track inventory/stock for this product. False is ideal for services or digital products';
