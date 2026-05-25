-- =========================================================
-- FIX RÁPIDO: Agregar TODAS las columnas faltantes
-- =========================================================

-- Agregar columna currency si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN currency text DEFAULT 'USD';
        RAISE NOTICE '✅ Columna currency agregada';
    ELSE
        RAISE NOTICE '✓ Columna currency ya existe';
    END IF;
END $$;

-- Agregar columna target_plan_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'target_plan_id'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN target_plan_id text;
        RAISE NOTICE '✅ Columna target_plan_id agregada';
    ELSE
        RAISE NOTICE '✓ Columna target_plan_id ya existe';
    END IF;
END $$;

-- Agregar columna bank_name si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN bank_name text;
        RAISE NOTICE '✅ Columna bank_name agregada';
    ELSE
        RAISE NOTICE '✓ Columna bank_name ya existe';
    END IF;
END $$;

-- Agregar columna proof_url si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'proof_url'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN proof_url text;
        RAISE NOTICE '✅ Columna proof_url agregada';
    ELSE
        RAISE NOTICE '✓ Columna proof_url ya existe';
    END IF;
END $$;

-- Agregar columna status si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN status text DEFAULT 'pending';
        RAISE NOTICE '✅ Columna status agregada';
    ELSE
        RAISE NOTICE '✓ Columna status ya existe';
    END IF;
END $$;

-- Agregar columna admin_note si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'admin_note'
    ) THEN
        ALTER TABLE public.payment_reports ADD COLUMN admin_note text;
        RAISE NOTICE '✅ Columna admin_note agregada';
    ELSE
        RAISE NOTICE '✓ Columna admin_note ya existe';
    END IF;
END $$;

-- Verificar estructura final
SELECT 
    column_name,
    data_type,
    column_default,
    '✅ VERIFICADO' as status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'payment_reports'
ORDER BY ordinal_position;

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TODAS LAS COLUMNAS VERIFICADAS';
    RAISE NOTICE '========================================';
END $$;
