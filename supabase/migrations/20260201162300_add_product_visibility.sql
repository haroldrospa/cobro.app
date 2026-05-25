-- Add is_visible_in_store column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_visible_in_store BOOLEAN DEFAULT true;

-- Loop through all products that don't have this value set (just in case)
UPDATE products SET is_visible_in_store = true WHERE is_visible_in_store IS NULL;
