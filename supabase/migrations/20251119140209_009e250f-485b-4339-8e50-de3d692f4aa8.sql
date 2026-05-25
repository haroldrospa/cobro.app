-- Add fields to sales table for credit payment tracking
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'overdue'));

-- Update existing credit sales to have pending status if they don't have amount_received
UPDATE public.sales 
SET payment_status = 'pending'
WHERE payment_method = 'credit' AND payment_status = 'paid';