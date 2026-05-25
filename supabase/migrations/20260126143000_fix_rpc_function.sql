-- 1. Crear tabla company_subscriptions si no existe (por seguridad)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL, 
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'pending_approval', 'rejected', 'expired')),
    payment_method TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Función para actualizar suscripción (ADMIN)
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

    -- Desactivar cualquier suscripción activa anterior para esta tienda
    UPDATE public.company_subscriptions 
    SET status = 'expired' 
    WHERE company_id = p_store_id AND status = 'active';

    -- Insertar la nueva suscripción
    INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
    VALUES (p_store_id, p_plan_id, 'active', now(), v_end_date, 'manual_admin');

    RETURN jsonb_build_object('success', true, 'message', 'Plan actualizado correctamente');
END;
$$;
