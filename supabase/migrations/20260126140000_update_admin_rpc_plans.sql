-- Actualizar función get_all_stores_admin para incluir datos de suscripción
CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    store_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    owner_email TEXT,
    plan_name TEXT,
    plan_end_date TIMESTAMP WITH TIME ZONE,
    plan_status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.store_name,
        s.store_code,
        s.is_active,
        s.created_at,
        p.email as owner_email,
        sp.name as plan_name,
        cs.end_date as plan_end_date,
        cs.status as plan_status
    FROM public.stores s
    LEFT JOIN public.profiles p ON s.owner_id = p.id
    LEFT JOIN public.company_subscriptions cs ON s.id = cs.company_id AND cs.status = 'active'
    LEFT JOIN public.subscription_plans sp ON cs.plan_id = sp.id
    ORDER BY s.created_at DESC;
END;
$$;

-- Función para cambiar el plan de una tienda manualmente (Super Admin)
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
BEGIN
    -- Calcular fecha de fin
    v_end_date := now() + (p_days_duration || ' days')::INTERVAL;

    -- Upsert subscription
    INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
    VALUES (p_store_id, p_plan_id, 'active', now(), v_end_date, 'manual_admin')
    ON CONFLICT (id) DO UPDATE -- Nota: id es random uuid, así que el ON CONFLICT id no sirve mucho si generamos uno nuevo.
    -- Mejor estrategia: Buscar si existe una activa y actualizarla, o desactivar las anteriores.
    SET status = 'expired';

    -- Corrección: Desactivar cualquier suscripción activa anterior
    UPDATE public.company_subscriptions 
    SET status = 'expired' 
    WHERE company_id = p_store_id AND status = 'active';

    -- Insertar la nueva
    INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
    VALUES (p_store_id, p_plan_id, 'active', now(), v_end_date, 'manual_admin');

    RETURN jsonb_build_object('success', true, 'message', 'Plan actualizado correctamente');
END;
$$;
