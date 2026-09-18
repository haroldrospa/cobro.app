-- ==============================================================================
-- MIGRACIÓN: AGREGAR CAMPOS BANCARIOS, TELÉFONO DE EMPRESA Y TELÉFONO DE CONTACTO
-- Ejecuta este script en el Editor SQL de Supabase (Dashboard -> SQL Editor)
-- ==============================================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'transfer',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT;

-- Recargar la caché del esquema de PostgREST para que Supabase reconozca las nuevas columnas de inmediato
NOTIFY pgrst, 'reload schema';
