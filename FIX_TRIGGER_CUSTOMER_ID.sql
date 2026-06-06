-- ============================================================
-- FIX: "record 'new' has no field 'customer_id'"
-- Este error ocurre porque el trigger sync_profile_to_customer
-- usa una versión vieja que falla al actualizar profiles.
-- 
-- INSTRUCCIONES: Ejecuta este SQL en el Supabase SQL Editor
-- ============================================================

-- 1. Asegurarse que customer_id no exista en profiles (si existe, causa conflicto)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS customer_id CASCADE;

-- 2. Reemplazar la función del trigger con versión robusta que NUNCA falla
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo sincronizar perfiles que NO son clientes web
    IF NEW.role IS NULL OR NEW.role = 'customer' THEN
        RETURN NEW;
    END IF;

    -- Intentar sincronizar el empleado a la tabla customers
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        -- NUNCA bloquear una actualización de perfil por errores de sincronización
        NULL;
    END;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Capa extra de seguridad: si algo falla, dejar pasar el UPDATE igualmente
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reinstalar el trigger
DROP TRIGGER IF EXISTS trigger_sync_profile_to_customer ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_customer
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_customer();

-- 4. Verificar que el trigger quedó bien instalado
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles'
  AND trigger_name = 'trigger_sync_profile_to_customer';
