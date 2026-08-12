-- ==============================================================================
-- FIX DEFINITIVO: FUNCIÓN RPC PARA ACTUALIZAR DÍAS Y PLANES DESDE EL PANEL MAESTRO
-- ==============================================================================
-- Instrucciones: Copia y pega TODO este contenido en el SQL Editor de Supabase
-- URL: https://supabase.com/dashboard -> Tu Proyecto -> SQL Editor -> Run
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
    p_store_id UUID,
    p_plan_id TEXT,
    p_days_duration INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_status TEXT := 'active';
    v_final_plan TEXT;
BEGIN
    v_final_plan := COALESCE(NULLIF(p_plan_id, ''), 'basic');

    IF p_days_duration <= 0 THEN
        v_end_date := now();
        v_status := 'expired';
    ELSE
        v_end_date := now() + (p_days_duration || ' days')::INTERVAL;
        v_status := 'active';
    END IF;

    -- 1. Si la tienda ya tiene registro en company_subscriptions, actualizar la fila existente
    IF EXISTS (SELECT 1 FROM public.company_subscriptions WHERE company_id = p_store_id) THEN
        UPDATE public.company_subscriptions
        SET 
            plan_id = v_final_plan,
            status = v_status,
            end_date = v_end_date,
            payment_method = 'other',
            updated_at = now()
        WHERE company_id = p_store_id;
    ELSE
        -- 2. Si es una tienda sin fila previa, insertar nuevo registro con payment_method 'other'
        INSERT INTO public.company_subscriptions (
            company_id, 
            plan_id, 
            status, 
            start_date, 
            end_date, 
            payment_method, 
            updated_at
        ) VALUES (
            p_store_id, 
            v_final_plan, 
            v_status, 
            now(), 
            v_end_date, 
            'other', 
            now()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Suscripción actualizada correctamente', 
        'store_id', p_store_id, 
        'end_date', v_end_date,
        'days_duration', p_days_duration
    );
END;
$$;

-- Otorgar permisos de ejecución para anon, authenticated y service_role
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(UUID, TEXT, INTEGER) TO anon, authenticated, service_role;
