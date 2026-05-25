-- Create cash_movements table for tracking deposits and withdrawals
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id),
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.cash_movements
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.cash_movements
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Add index
CREATE INDEX idx_cash_movements_store_id ON public.cash_movements(store_id);
CREATE INDEX idx_cash_movements_created_at ON public.cash_movements(created_at);
