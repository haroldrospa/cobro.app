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
        COALESCE(sp.name, 'Sin Plan') as plan_name,
        sub.end_date as plan_end_date,
        sub.status as plan_status
    FROM public.stores s
    LEFT JOIN public.profiles p ON s.owner_id = p.id
    -- Usamos LATERAL JOIN para traer siempre la última suscripción registrada, esté activa o no.
    LEFT JOIN LATERAL (
        SELECT cs.plan_id, cs.status, cs.end_date
        FROM public.company_subscriptions cs
        WHERE cs.company_id = s.id
        ORDER BY cs.created_at DESC
        LIMIT 1
    ) sub ON true
    LEFT JOIN public.subscription_plans sp ON sub.plan_id = sp.id
    ORDER BY s.created_at DESC;
END;
$$;
