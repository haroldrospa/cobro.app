-- Add is_variable_quantity column to products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='is_variable_quantity') THEN
        ALTER TABLE products ADD COLUMN is_variable_quantity BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN products.is_variable_quantity IS 'If true, the quantity prompt appears at the time of sale (POS) for weighted or partial items';
    END IF;
END $$;
