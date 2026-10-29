-- Actualizar monto mínimo de recarga de billetera a RD$ 100 (mínimo 100, máximo 20,000)

-- 1. Modificar restricción de monto en la tabla digital_services_topup_requests
ALTER TABLE public.digital_services_topup_requests 
DROP CONSTRAINT IF EXISTS digital_services_topup_requests_amount_check;

ALTER TABLE public.digital_services_topup_requests 
ADD CONSTRAINT digital_services_topup_requests_amount_check 
CHECK (amount >= 100 AND amount <= 20000);

-- 2. Actualizar función RPC submit_digital_service_topup
CREATE OR REPLACE FUNCTION public.submit_digital_service_topup(
    p_store_id UUID,
    p_amount NUMERIC(12,2),
    p_bank_name TEXT,
    p_reference_number TEXT,
    p_receipt_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_id UUID;
BEGIN
    IF p_amount < 100 OR p_amount > 20000 THEN
        RAISE EXCEPTION 'El monto debe estar entre RD$ 100 y RD$ 20,000';
    END IF;

    IF p_bank_name IS NULL OR length(trim(p_bank_name)) = 0 THEN
        RAISE EXCEPTION 'Debe seleccionar el banco de la transferencia';
    END IF;

    IF p_reference_number IS NULL OR length(trim(p_reference_number)) = 0 THEN
        RAISE EXCEPTION 'Debe ingresar el número de referencia del comprobante';
    END IF;

    INSERT INTO public.digital_services_topup_requests (
        store_id,
        user_id,
        amount,
        bank_name,
        reference_number,
        receipt_url,
        notes,
        status
    ) VALUES (
        p_store_id,
        v_user_id,
        p_amount,
        trim(p_bank_name),
        trim(p_reference_number),
        p_receipt_url,
        p_notes,
        'pending'
    )
    RETURNING id INTO v_req_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'message', 'Solicitud enviada exitosamente. Se acreditará tras la validación administrativa.'
    );
END;
$$;
