-- Add amount_paid column to track partial payments on invoices
ALTER TABLE public.sales 
ADD COLUMN amount_paid numeric DEFAULT 0;

-- Update existing paid invoices to have amount_paid equal to total
UPDATE public.sales 
SET amount_paid = total 
WHERE payment_status = 'paid';

-- Update pending invoices to have amount_paid = 0
UPDATE public.sales 
SET amount_paid = 0 
WHERE payment_status = 'pending' AND amount_paid IS NULL;