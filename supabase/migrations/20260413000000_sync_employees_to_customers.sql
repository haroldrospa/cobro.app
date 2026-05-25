-- ==========================================
-- AUTOMATIC SYNC: EMPLOYEES -> CUSTOMERS (VERSIÓN ULTRA-ROBUSTA)
-- ==========================================

-- 1. PREPARAR TABLA DE CLIENTES
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_employee BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Asegurar que profile_id sea único en customers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_profile_id_key') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_profile_id_key UNIQUE (profile_id);
    END IF;
END $$;

-- 2. ELIMINAR VINCULACIÓN MANUAL ANTIGUA (Si existe)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS customer_id CASCADE;

-- 3. VINCULACIÓN INTELIGENTE (CON PREVENCIÓN DE DUPLICADOS)
-- Vinculamos solo el registro de cliente más importante (por deudas o puntos)
-- Esto evita el error 23505 si hay dos clientes con el mismo email/nombre
UPDATE public.customers c
SET profile_id = p.id, is_employee = TRUE
FROM public.profiles p
WHERE c.id = (
    -- Buscamos el mejor candidato a cliente para este perfil
    SELECT target.id 
    FROM public.customers target
    WHERE (LOWER(target.email) = LOWER(p.email) OR LOWER(target.name) = LOWER(p.full_name))
      AND target.store_id = p.store_id
      AND target.profile_id IS NULL
    ORDER BY target.total_purchases DESC, target.created_at DESC
    LIMIT 1
)
AND p.role != 'customer';

-- 4. FUNCIÓN DE SINCRONIZACIÓN PERPETUA
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role != 'customer' THEN
        INSERT INTO public.customers (
            name, 
            email, 
            phone, 
            store_id, 
            is_employee, 
            profile_id,
            customer_type
        )
        VALUES (
            COALESCE(NEW.full_name, 'Empleado Sin Nombre'),
            NEW.email,
            NEW.phone,
            NEW.store_id,
            TRUE,
            NEW.id,
            'final'
        )
        ON CONFLICT (profile_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            store_id = EXCLUDED.store_id,
            is_employee = TRUE,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. RE-INSTALAR TRIGGER
DROP TRIGGER IF EXISTS trigger_sync_profile_to_customer ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_customer
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_customer();

-- 6. SINCRONIZACIÓN FINAL (CON ON CONFLICT)
INSERT INTO public.customers (name, email, phone, store_id, is_employee, profile_id, customer_type)
SELECT 
    COALESCE(full_name, 'Empleado'), 
    email, 
    phone, 
    store_id, 
    TRUE, 
    id,
    'final'
FROM public.profiles
WHERE role != 'customer'
ON CONFLICT (profile_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    is_employee = TRUE;

-- 7. LIMPIEZA AL ELIMINAR EMPLEADO
CREATE OR REPLACE FUNCTION public.handle_employee_deletion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.customers 
    SET is_employee = FALSE, profile_id = NULL 
    WHERE profile_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_employee_deletion ON public.profiles;
CREATE TRIGGER trigger_handle_employee_deletion
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_employee_deletion();
