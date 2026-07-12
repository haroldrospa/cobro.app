-- =========================================================================
-- MIGRACIÓN 18: AGREGAR COLUMNA 'supplier_name' A LA TABLA 'pos_quick_notes'
-- Ejecutar en Supabase SQL Editor
-- =========================================================================

ALTER TABLE public.pos_quick_notes 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- Recargar caché de PostgREST para que reconozca la nueva columna de inmediato
NOTIFY pgrst, 'reload schema';
