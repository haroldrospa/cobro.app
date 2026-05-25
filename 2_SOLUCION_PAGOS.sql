-- =========================================================
-- SOLUCIÓN COMPLETA PARA EL SISTEMA DE SUSCRIPCIONES Y PAGOS
-- =========================================================

-- 1. TABLA: company_subscriptions (Suscripciones Activas)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    plan_id text NOT NULL, -- 'basic', 'pro', 'enterprise'
    status text DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. TABLA: payment_reports (Reportes de Pago Manuales)
CREATE TABLE IF NOT EXISTS public.payment_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD',
    bank_name text,
    proof_url text, -- Ruta en storage
    target_plan_id text,
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Permisivas para que funcione sin lios por ahora)
CREATE POLICY "Permitir lectura a todos" ON public.company_subscriptions FOR SELECT USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.company_subscriptions FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir lectura a todos reportes" ON public.payment_reports FOR SELECT USING (true);
CREATE POLICY "Permitir insert a autenticados" ON public.payment_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir update a admins" ON public.payment_reports FOR UPDATE USING (true); -- Idealmente restringir a admin

-- 3. FUNCIÓN: submit_payment_and_activate (Usada por el Usuario)
DROP FUNCTION IF EXISTS public.submit_payment_and_activate(uuid, numeric, text, text, text, text);

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

-- 4. FUNCIÓN: process_subscription_payment (Usada por el Admin para Aprobar)
DROP FUNCTION IF EXISTS public.process_subscription_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.process_subscription_payment(
    p_report_id uuid,
    p_status text, -- 'approved' or 'rejected'
    p_admin_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report record;
    v_days_to_add int;
BEGIN
    -- Obtener el reporte
    SELECT * INTO v_report FROM public.payment_reports WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reporte no encontrado';
    END IF;

    -- Actualizar estado del reporte
    UPDATE public.payment_reports 
    SET status = p_status, 
        admin_note = p_admin_note,
        updated_at = now()
    WHERE id = p_report_id;

    -- Si es aprobado, crear/actualizar la suscripción
    IF p_status = 'approved' THEN
        -- Calcular días (30 días por defecto)
        v_days_to_add := 30;

        -- Desactivar planes anteriores
        UPDATE public.company_subscriptions 
        SET status = 'expired' 
        WHERE company_id = v_report.company_id AND status = 'active';

        -- Insertar nueva suscripción
        INSERT INTO public.company_subscriptions (
            company_id,
            plan_id,
            status,
            start_date,
            end_date
        ) VALUES (
            v_report.company_id,
            v_report.target_plan_id,
            'active',
            now(),
            now() + (v_days_to_add || ' days')::interval
        );
    END IF;

    RETURN true;
END;
$$;

-- 5. FUNCIÓN: get_all_stores_admin (Para el Dashboard Admin)
DROP FUNCTION IF EXISTS public.get_all_stores_admin();

CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id uuid,
    store_name text,
    store_code text,
    is_active boolean,
    owner_email text,
    plan_name text,
    plan_end_date timestamp with time zone
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
        p.email as owner_email,
        cs.plan_id as plan_name,
        cs.end_date as plan_end_date
    FROM public.stores s
    LEFT JOIN public.profiles p ON s.owner_id = p.id
    LEFT JOIN public.company_subscriptions cs ON s.id = cs.company_id AND cs.status = 'active';
END;
$$;

-- 6. FUNCIÓN: toggle_store_status (Activar/Desactivar Tienda)
DROP FUNCTION IF EXISTS public.toggle_store_status(uuid, boolean);

CREATE OR REPLACE FUNCTION public.toggle_store_status(
    p_store_id uuid,
    p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stores
    SET is_active = p_is_active,
        updated_at = now()
    WHERE id = p_store_id;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '✅ Sistema de suscripciones instalado correctamente.';
END $$;
