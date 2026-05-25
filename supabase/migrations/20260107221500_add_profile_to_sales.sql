-- Add profile_id to sales table to track who created the sale
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_profile_id ON public.sales(profile_id);

-- Optional: Update existing sales to link to the store owner if possible, or leave null
-- We can try to link based on store owner for now as a fallback, 
-- but since we don't know who created past sales exactly if we didn't track it, leaving as NULL or default owner is best effort.
-- For now, we will leave it NULL for past sales.
