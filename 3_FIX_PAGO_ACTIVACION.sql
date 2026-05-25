-- =========================================================
-- FIX: ACTIVAR PLAN INMEDIATAMENTE AL SUBIR COMPROBANTE
-- =========================================================

CREATE OR REPLACE FUNCTION public.submit_payment_and_activate(
    p_company_id uuid,
    p_amount numeric,
    p_currency text,
    p_bank_name text,
    p_proof_url text,
    p_target_plan_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_days_to_add int := 30;
BEGIN
    -- 1. Insertar el reporte de pago
    INSERT INTO public.payment_reports (
        company_id,
        amount,
        currency,
        bank_name,
        proof_url,
        target_plan_id,
        status
    ) VALUES (
        p_company_id,
        p_amount,
        p_currency,
        p_bank_name,
        p_proof_url,
        p_target_plan_id,
        'pending'
    );

    -- 2. ACTIVAR EL PLAN INMEDIATAMENTE
    -- Desactivar cualquier plan activo actual
    UPDATE public.company_subscriptions 
    SET status = 'expired' 
    WHERE company_id = p_company_id AND status = 'active';

    -- Insertar el nuevo plan activo
    INSERT INTO public.company_subscriptions (
        company_id,
        plan_id,
        status,
        start_date,
        end_date
    ) VALUES (
        p_company_id,
        p_target_plan_id,
        'active',
        now(),
        now() + (v_days_to_add || ' days')::interval
    );

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in submit_payment_and_activate: %', SQLERRM;
    RETURN false;
END;
$$;

-- Confirmación visual
DO $$
BEGIN
    RAISE NOTICE '✅ Función de activación inmediata actualizada correctamente.';
END $$;
