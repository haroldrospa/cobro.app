-- Create cash_sessions table to manage open/closed shifts
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    
    -- Opening Info
    opened_by UUID REFERENCES public.profiles(id),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    initial_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    
    -- Closing Info (Nullable until closed)
    closed_by UUID REFERENCES public.profiles(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Closing Metrics (Nullable until closed)
    total_sales_cash DECIMAL(10, 2),
    total_sales_card DECIMAL(10, 2),
    total_sales_transfer DECIMAL(10, 2),
    total_sales_other DECIMAL(10, 2),
    total_refunds DECIMAL(10, 2),
    
    total_cash_in DECIMAL(10, 2),
    total_cash_out DECIMAL(10, 2),
    
    expected_cash DECIMAL(10, 2), -- initial + sales_cash + in - out
    actual_cash DECIMAL(10, 2),
    difference DECIMAL(10, 2),
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.cash_sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.cash_sessions
    FOR INSERT WITH CHECK (auth.uid() = opened_by);

CREATE POLICY "Enable update access for authenticated users" ON public.cash_sessions
    FOR UPDATE USING (true); 

-- Indexes
CREATE INDEX idx_cash_sessions_store_id ON public.cash_sessions(store_id);
CREATE INDEX idx_cash_sessions_status ON public.cash_sessions(status);
CREATE INDEX idx_cash_sessions_created_at ON public.cash_sessions(created_at);

-- Grants
GRANT ALL ON TABLE public.cash_sessions TO postgres;
GRANT ALL ON TABLE public.cash_sessions TO anon;
GRANT ALL ON TABLE public.cash_sessions TO authenticated;
GRANT ALL ON TABLE public.cash_sessions TO service_role;
