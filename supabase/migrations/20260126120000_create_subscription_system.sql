-- 1. Tabla de Planes (Definición de precios y límites)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY, -- 'basic', 'pro', 'enterprise'
    name TEXT NOT NULL,
    description TEXT,
    price_monthlyNUMERIC NOT NULL DEFAULT 0,
    price_yearly NUMERIC NOT NULL DEFAULT 0,
    features JSONB DEFAULT '{}'::jsonb, -- Ej: {"users": 1, "invoices": 100}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar planes por defecto (Puedes editar los precios a tu moneda, ej: Pesos DOP)
INSERT INTO public.subscription_plans (id, name, description, price_monthly, price_yearly, features)
VALUES 
    ('basic', 'Plan Básico', 'Para pequeños negocios que inician.', 1500, 15000, '{"users": 1, "products": 100, "invoices_per_month": 50}'::jsonb),
    ('pro', 'Plan Profesional', 'Para negocios en crecimiento.', 3000, 30000, '{"users": 3, "products": 1000, "invoices_per_month": -1}'::jsonb), -- -1 = Ilimitado
    ('enterprise', 'Plan Empresarial', 'Gestión total sin límites.', 6000, 60000, '{"users": 10, "products": -1, "invoices_per_month": -1}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de Suscripciones (Vincula tu negocio con un plan)
-- Asumiendo que 'store_settings' es la tabla principal del negocio.
-- Si hay varias tablas de negocios, ajústalo.
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Intentamos vincular con company_id si es que usas 'companies' o 'store_settings'
    -- Si no tienes tabla 'companies', usa el ID del owner en 'profiles'
    company_id UUID NOT NULL, 
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'pending_approval', 'rejected', 'expired')),
    payment_method TEXT CHECK (payment_method IN ('transfer', 'paypal', 'cash', 'other')),
    
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE, -- Cuándo expira (importante)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla para Reportar Pagos (Comprobantes de Transferencia)
CREATE TABLE IF NOT EXISTS public.payment_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'DOP',
    bank_name TEXT, -- 'Banco Popular', 'BHD', 'PayPal'
    reference_number TEXT, -- Numero de referencia o transacción
    proof_url TEXT, -- URL de la foto del voucher en Supabase Storage
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT, -- Nota tuya (ej: "Pago recibido ok")
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Policies)

-- Planes: Todo el mundo puede leerlos
CREATE POLICY "Anyone can read plans" ON public.subscription_plans FOR SELECT USING (true);

-- Suscripciones: Solo el dueño de la compañía puede ver su propia suscripción
-- (Aquí tendrás que ajustar 'company_id' a cómo tu auth maneja la compañía actual)
-- Por ahora, permitimos leer si el usuario está autenticado (deberás refinar esto)
CREATE POLICY "Users can see their own subscription" ON public.company_subscriptions 
    FOR SELECT 
    USING (auth.uid() IS NOT NULL); -- TODO: Refinar con company_id = auth.uid() o similar

-- Reportes: Usuario puede crear reportes y ver los suyos
CREATE POLICY "Users can create payment reports" ON public.payment_reports 
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their payment reports" ON public.payment_reports 
    FOR SELECT 
    USING (auth.uid() IS NOT NULL); -- TODO: Vincular con company_id

-- 4. Configuración de Storage para Comprobantes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Users can upload payment proofs" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');
  
CREATE POLICY "Users can view own payment proofs" ON storage.objects 
  FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.uid() = owner);
