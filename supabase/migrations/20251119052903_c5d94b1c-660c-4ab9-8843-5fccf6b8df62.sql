-- Add tax_percentage column to products table
ALTER TABLE products
ADD COLUMN tax_percentage numeric DEFAULT 18 CHECK (tax_percentage >= 0 AND tax_percentage <= 100);