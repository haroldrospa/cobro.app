-- Agregar columnas company_id y sequence_due_date a alanube_config para sincronizacion completa en Supabase
ALTER TABLE public.alanube_config ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.alanube_config ADD COLUMN IF NOT EXISTS sequence_due_date TEXT;
