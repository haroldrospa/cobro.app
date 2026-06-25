-- ============================================================================
-- SCRIPT DE MIGRACIÓN: AGREGAR COLUMNA DE PLANILLAS DE ETIQUETAS A STORE_SETTINGS
-- Ejecuta este script en el editor SQL de Supabase para actualizar la base de datos.
-- ============================================================================

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS label_templates jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.store_settings.label_templates IS 'Custom label and barcode print templates/settings';
