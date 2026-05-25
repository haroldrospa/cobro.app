-- Función para reportar pago y ACTIVAR INMEDIATAMENTE el plan (Voto de confianza)
CREATE OR REPLACE FUNCTION public.submit_payment_and_activate(
    p_company_id UUID,
    p_amount NUMERIC,
    p_currency TEXT,
    p_bank_name TEXT,
    p_proof_url TEXT,
    p_target_plan_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_days_duration INTEGER := 30; -- Duración por defecto
BEGIN
    -- 1. Crear el reporte de pago (para auditoría del admin)
    INSERT INTO public.payment_reports (
        company_id,
        amount,
        currency,
        bank_name,
        proof_url,
        status, -- Lo marcamos como 'approved' automáticamente o 'pending_review' pero damos acceso
        target_plan_id
    ) VALUES (
        p_company_id,
        p_amount,
        p_currency,
        p_bank_name,
        p_proof_url,
        'pending', -- Se queda pendiente de revisión real, PERO...
        p_target_plan_id
    );

    -- 2. ACTIVAR EL PLAN INMEDIATAMENTE (Acceso Provisional)
    -- Buscamos si ya tiene suscripción para actualizarla
    IF EXISTS (SELECT 1 FROM public.company_subscriptions WHERE company_id = p_company_id) THEN
        UPDATE public.company_subscriptions
        SET 
            plan_id = p_target_plan_id,
            status = 'active',
            start_date = now(),
            end_date = now() + (v_days_duration || ' days')::INTERVAL,
            payment_method = 'paypal_auto_claim',
            updated_at = now()
        WHERE company_id = p_company_id;
    ELSE
        -- Si no tiene, creamos una nueva
        INSERT INTO public.company_subscriptions (
            company_id, 
            plan_id, 
            status, 
            start_date, 
            end_date, 
            payment_method
        ) VALUES (
            p_company_id, 
            p_target_plan_id, 
            'active', 
            now(), 
            now() + (v_days_duration || ' days')::INTERVAL,
            'paypal_auto_claim'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Plan activado exitosamente');
END;
$$;
