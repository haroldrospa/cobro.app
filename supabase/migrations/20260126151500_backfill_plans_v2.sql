-- 1. Añadir columna faltante si no existe
ALTER TABLE public.company_subscriptions 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 2. Actualizar nombres de planes para coincidir con la UI
UPDATE public.subscription_plans 
SET name = 'Plan Emprendedor' 
WHERE id = 'basic';

-- 3. Asignar Plan Emprendedor a tiendas sin plan
INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
SELECT 
    s.id, 
    'basic', 
    'active', 
    now(), 
    now() + INTERVAL '14 days',
    'system_backfill'
FROM public.stores s
WHERE s.id NOT IN (
    SELECT company_id FROM public.company_subscriptions WHERE status = 'active'
);
