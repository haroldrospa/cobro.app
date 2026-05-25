-- Add discount fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_start_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_end_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.products.discount_percentage IS 'Discount percentage (0-100) applied to the product';
COMMENT ON COLUMN public.products.discount_start_date IS 'Start date for the discount period';
COMMENT ON COLUMN public.products.discount_end_date IS 'End date for the discount period';
COMMENT ON COLUMN public.products.is_featured IS 'Whether the product is featured/highlighted';