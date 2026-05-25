-- Create daily_closings table
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id),
    opening_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()), -- For now, maybe just track when the period started? Or just 'closing_time'
    closing_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    total_sales_cash DECIMAL(10, 2) DEFAULT 0,
    total_sales_card DECIMAL(10, 2) DEFAULT 0,
    total_sales_transfer DECIMAL(10, 2) DEFAULT 0,
    total_sales_other DECIMAL(10, 2) DEFAULT 0,
    
    total_refunds DECIMAL(10, 2) DEFAULT 0, -- Total value of refunds
    
    total_cash_in DECIMAL(10, 2) DEFAULT 0, -- From cash_movements (deposits)
    total_cash_out DECIMAL(10, 2) DEFAULT 0, -- From cash_movements (withdrawals)
    
    expected_cash DECIMAL(10, 2) DEFAULT 0, -- Calculated system cash
    actual_cash DECIMAL(10, 2) DEFAULT 0, -- User input
    difference DECIMAL(10, 2) DEFAULT 0, -- actual - expected
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.daily_closings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.daily_closings
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Indexes
CREATE INDEX idx_daily_closings_store_id ON public.daily_closings(store_id);
CREATE INDEX idx_daily_closings_created_at ON public.daily_closings(created_at);

-- Grants
GRANT ALL ON TABLE public.daily_closings TO postgres;
GRANT ALL ON TABLE public.daily_closings TO anon;
GRANT ALL ON TABLE public.daily_closings TO authenticated;
GRANT ALL ON TABLE public.daily_closings TO service_role;
