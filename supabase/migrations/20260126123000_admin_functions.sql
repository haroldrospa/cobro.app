-- Función segura para Aprobar Pagos de Suscripción
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
    p_report_id UUID,
    p_status TEXT, -- 'approved' o 'rejected'
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos de superusuario
AS $$
DECLARE
    v_report RECORD;
    v_months_to_add INT := 1; -- Por defecto agrega 1 mes
    v_new_end_date TIMESTAMPTZ;
    v_current_sub RECORD;
BEGIN
    -- 1. Buscar el reporte
    SELECT * INTO v_report FROM public.payment_reports WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Reporte no encontrado');
    END IF;

    -- 2. Actualizar estado del reporte
    UPDATE public.payment_reports 
    SET 
        status = p_status,
        admin_note = p_admin_note,
        status_updated_at = now()
    WHERE id = p_report_id;

    -- 3. Si es aprobado, activar/extender suscripción
    IF p_status = 'approved' THEN
        
        -- Buscar suscripción actual
        SELECT * INTO v_current_sub 
        FROM public.company_subscriptions 
        WHERE company_id = v_report.company_id 
        LIMIT 1;

        -- Calcular nueva fecha de fin
        -- Si ya tiene una fecha futura, sumamos meses. Si está vencida o nula, es desde hoy.
        IF v_current_sub.end_date IS NOT NULL AND v_current_sub.end_date > now() THEN
            v_new_end_date := v_current_sub.end_date + (v_months_to_add || ' month')::INTERVAL;
        ELSE
            v_new_end_date := now() + (v_months_to_add || ' month')::INTERVAL;
        END IF;

        -- Upsert la suscripción (Crear o Actualizar)
        INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date)
        VALUES (
            v_report.company_id, 
            'pro', -- Por defecto asignamos PRO al aprobar (podrías dinamizarlo si guardas el plan en el reporte)
            'active',
            now(),
            v_new_end_date
        )
        ON CONFLICT (company_id) -- (Asumiendo que company_id debería ser único o tener constraint, si no usar ID)
        -- Nota: Si tu tabla no tiene constraint unique en company_id, esto insertaría duplicados. 
        -- Para SaaS simple asumimos 1 suscripción por compañia.
        -- Ajuste seguro: UPDATE en lugar de INSERT si existe.
        DO UPDATE SET
            status = 'active',
            end_date = EXCLUDED.end_date,
            updated_at = now();
            
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Pago procesado correctamente',
        'new_end_date', v_new_end_date
    );
END;
$$;

-- Añadir columna de fecha de actualización al reporte si falta
ALTER TABLE public.payment_reports ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- IMPORTANTE: Crear un constraint único para suscripciones si no existe, 
-- para asegurar una sola suscripción activa por empresa.
-- (Borro duplicados viejos primero por seguridad)
-- DELETE FROM public.company_subscriptions WHERE id NOT IN (SELECT max(id) FROM public.company_subscriptions GROUP BY company_id);
-- ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_company_id_key UNIQUE (company_id);
