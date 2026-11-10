-- Agregar columna end_number a invoice_sequences para control de rango de comprobantes DGII y alertas de reposicion
ALTER TABLE public.invoice_sequences ADD COLUMN IF NOT EXISTS end_number INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.invoice_sequences.end_number IS 'Número final autorizado por la DGII para el rango de la secuencia';
