ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS split_cash DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS split_method TEXT;
