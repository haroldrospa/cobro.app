-- Función para actualizar la secuencia de facturas al máximo utilizado
-- Esto es CRÍTICO para el funcionamiento offline: cuando se sincronizan facturas creadas offline,
-- debemos asegurar que la secuencia en la base de datos "alcance" a la numeración utilizada localmente.

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
