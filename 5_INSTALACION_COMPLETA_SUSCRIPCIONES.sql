-- =========================================================
-- INSTALACIÓN COMPLETA: Sistema de Suscripciones
-- =========================================================
-- Este script crea o actualiza TODA la estructura necesaria

-- 1. CREAR TABLA: company_subscriptions (si no existe)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    plan_id text NOT NULL,
    status text DEFAULT 'active',
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. CREAR TABLA: payment_reports (si no existe)
CREATE TABLE IF NOT EXISTS public.payment_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD',
    bank_name text,
    proof_url text,
    target_plan_id text,
    status text DEFAULT 'pending',
    admin_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. AGREGAR COLUMNA currency SI NO EXISTE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.payment_reports 
        ADD COLUMN currency text DEFAULT 'USD';
        RAISE NOTICE '✅ Columna currency agregada';
    END IF;
END $$;

-- 4. HABILITAR RLS (Row Level Security)
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

-- 5. CREAR POLÍTICAS DE SEGURIDAD (si no existen)
DO $$
BEGIN
    -- Políticas para company_subscriptions
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'company_subscriptions' AND policyname = 'Permitir lectura a todos'
    ) THEN
        CREATE POLICY "Permitir lectura a todos" ON public.company_subscriptions FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'company_subscriptions' AND policyname = 'Permitir todo a autenticados'
    ) THEN
        CREATE POLICY "Permitir todo a autenticados" ON public.company_subscriptions FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    -- Políticas para payment_reports
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir lectura a todos reportes'
    ) THEN
        CREATE POLICY "Permitir lectura a todos reportes" ON public.payment_reports FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir insert a autenticados'
    ) THEN
        CREATE POLICY "Permitir insert a autenticados" ON public.payment_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'payment_reports' AND policyname = 'Permitir update a admins'
    ) THEN
        CREATE POLICY "Permitir update a admins" ON public.payment_reports FOR UPDATE USING (true);
    END IF;
END $$;

-- 6. CREAR/ACTUALIZAR FUNCIÓN: submit_payment_and_activate
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

-- 7. CREAR STORAGE BUCKET para comprobantes (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM storage.buckets WHERE name = 'payment-proofs'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('payment-proofs', 'payment-proofs', false);
        RAISE NOTICE '✅ Bucket payment-proofs creado';
    END IF;
END $$;

-- 8. CREAR POLÍTICA DE STORAGE para subir archivos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname = 'Permitir subida de comprobantes'
    ) THEN
        CREATE POLICY "Permitir subida de comprobantes"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'payment-proofs');
        RAISE NOTICE '✅ Política de storage creada';
    END IF;
END $$;

-- 9. Mensaje final
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SISTEMA DE SUSCRIPCIONES INSTALADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Puedes probar el sistema ahora.';
END $$;

-- 10. VERIFICACIÓN: Mostrar estructura de las tablas
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('company_subscriptions', 'payment_reports')
ORDER BY table_name, ordinal_position;
