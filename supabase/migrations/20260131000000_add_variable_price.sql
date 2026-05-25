-- Add is_variable_price column to products table
ALTER TABLE products ADD COLUMN is_variable_price BOOLEAN DEFAULT FALSE;

-- Update comment
COMMENT ON COLUMN products.is_variable_price IS 'If true, the price is set at the time of sale (POS)';
