-- =========================================================
-- SCRIPT DE VERIFICACIÓN: Sistema de Suscripciones
-- =========================================================
-- Ejecuta este script para verificar que todo esté configurado correctamente

-- 1. Verificar que las tablas existen
SELECT 
    '✅ Tabla company_subscriptions existe' as status
WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'company_subscriptions'
);

SELECT 
    '✅ Tabla payment_reports existe' as status
WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_reports'
);

-- 2. Verificar que la función existe y está actualizada
SELECT 
    routine_name,
    '✅ Función existe' as status,
    specific_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'submit_payment_and_activate';

-- 3. Ver el código fuente de la función actual
SELECT 
    pg_get_functiondef(oid) as funcion_actual
FROM pg_proc
WHERE proname = 'submit_payment_and_activate'
AND pronamespace = 'public'::regnamespace;

-- 4. Verificar suscripciones existentes
SELECT 
    cs.id,
    cs.company_id,
    s.store_name,
    cs.plan_id,
    cs.status,
    cs.start_date,
    cs.end_date
FROM public.company_subscriptions cs
LEFT JOIN public.stores s ON s.id = cs.company_id
ORDER BY cs.created_at DESC
LIMIT 10;

-- 5. Verificar reportes de pago recientes
SELECT 
    pr.id,
    pr.company_id,
    s.store_name,
    pr.amount,
    pr.currency,
    pr.target_plan_id,
    pr.status,
    pr.created_at
FROM public.payment_reports pr
LEFT JOIN public.stores s ON s.id = pr.company_id
ORDER BY pr.created_at DESC
LIMIT 10;

-- 6. Verificar storage bucket para comprobantes
SELECT 
    name,
    id,
    public as is_public
FROM storage.buckets
WHERE name = 'payment-proofs';
