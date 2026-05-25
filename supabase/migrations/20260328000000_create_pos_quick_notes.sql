-- Create pos_quick_notes table
CREATE TABLE IF NOT EXISTS public.pos_quick_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pos_quick_notes ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pos_quick_notes' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.pos_quick_notes
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_quick_notes_store_id ON public.pos_quick_notes(store_id);
CREATE INDEX IF NOT EXISTS idx_pos_quick_notes_due_date ON public.pos_quick_notes(due_date);

-- Grants
GRANT ALL ON TABLE public.pos_quick_notes TO postgres;
GRANT ALL ON TABLE public.pos_quick_notes TO anon;
GRANT ALL ON TABLE public.pos_quick_notes TO authenticated;
GRANT ALL ON TABLE public.pos_quick_notes TO service_role;
