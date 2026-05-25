-- =========================================================
--  SCRIPT CRÍTICO PARA DETECTAR Y REGISTRAR FACTURAS OFFLINE
-- =========================================================
--
-- INSTRUCCIONES:
-- 1. Copia TODO este contenido.
-- 2. Ve al SQL Editor de Supabase.
-- 3. Pégalo y ejecútalo (Run).
-- 4. Si dice "Success", entonces reinicia tu aplicación web.

-- Función para actualizar la secuencia de facturas al máximo utilizado
CREATE OR REPLACE FUNCTION public.update_invoice_sequence_max(
    p_invoice_type_id text,
    p_store_id uuid,
    p_new_sequence_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo actualiza si el número nuevo es MAYOR al actual
    UPDATE public.invoice_sequences
    SET current_number = p_new_sequence_number,
        updated_at = NOW()
    WHERE invoice_type_id = p_invoice_type_id
      AND store_id = p_store_id
      AND current_number < p_new_sequence_number;
END;
$$;

-- Verificar que se creó correctamente
DO $$
BEGIN
    RAISE NOTICE '✅ Función update_invoice_sequence_max instalada correctamente.';
END $$;
