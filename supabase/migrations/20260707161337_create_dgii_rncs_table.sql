-- Create dgii_rncs table
CREATE TABLE IF NOT EXISTS public.dgii_rncs (
    rnc TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dgii_rncs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to dgii_rncs
CREATE POLICY "Allow public read access to dgii_rncs"
    ON public.dgii_rncs
    FOR SELECT
    USING (true);

-- No public insert/update/delete policies are created
-- Meaning ONLY Service Role or Postgres superuser can modify the table.
