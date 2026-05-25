-- =========================================================
-- FIX: Agregar columna "currency" a payment_reports
-- =========================================================

-- Verificar si la columna ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_reports' 
        AND column_name = 'currency'
    ) THEN
        -- Agregar la columna currency
        ALTER TABLE public.payment_reports 
        ADD COLUMN currency text DEFAULT 'USD';
        
        RAISE NOTICE '✅ Columna "currency" agregada exitosamente';
    ELSE
        RAISE NOTICE '⚠️  La columna "currency" ya existe';
    END IF;
END $$;

-- Verificar que la columna existe ahora
SELECT 
    column_name, 
    data_type, 
    column_default,
    '✅ Columna verificada' as status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'payment_reports'
AND column_name = 'currency';
