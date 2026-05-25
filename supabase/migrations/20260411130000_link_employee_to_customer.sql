-- Link profiles to customers for cross-module credit management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Index for better performance when fetching debts
CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON public.profiles(customer_id);

-- Add a comment to describe the link
COMMENT ON COLUMN public.profiles.customer_id IS 'Link to a record in the customers table to track POS-generated debts for payroll deduction';
