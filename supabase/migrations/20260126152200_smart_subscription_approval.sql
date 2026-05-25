-- 1. Añadir columna target_plan_id a payment_reports
ALTER TABLE public.payment_reports
ADD COLUMN IF NOT EXISTS target_plan_id TEXT;

-- 2. Actualizar la función de proceso de pagos para usar el plan objetivo
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
    p_report_id UUID,
    p_status TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report RECORD;
    v_days_to_add INTEGER;
BEGIN
    -- Obtener datos del reporte
    SELECT * INTO v_report FROM public.payment_reports WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Reporte no encontrado');
    END IF;

    -- Actualizar estado del reporte
    UPDATE public.payment_reports 
    SET status = p_status, 
        admin_note = p_admin_note,
        updated_at = now()
    WHERE id = p_report_id;

    -- Si se aprueba, activar suscripción
    IF p_status = 'approved' THEN
        -- Calcular duración basada en monto (regla simple o fija)
        -- Por defecto 30 días, o podrías hacerlo más complejo math
        v_days_to_add := 30; 

        -- Insertar nueva suscripción o actualizar
        -- Usamos el target_plan_id si existe, si no, mantenemos el actual (lógica básica) o 'basic'
        INSERT INTO public.company_subscriptions (
            company_id, 
            plan_id, 
            status, 
            start_date, 
            end_date, 
            payment_method
        )
        VALUES (
            v_report.company_id,
            COALESCE(v_report.target_plan_id, 'basic'), -- PLAN ELEGIDO AUTOMÁTICAMENTE
            'active',
            now(),
            now() + (v_days_to_add || ' days')::INTERVAL,
            'paypal_manual'
        );
        
        -- Actualizar profile store_id si fuera necesario (redundancia)
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
