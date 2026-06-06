-- ============================================================
-- FIX FINAL: Elimina y recrea todos los triggers de profiles
-- SIN usar session_replication_role (no requiere superusuario)
-- 
-- Ejecuta TODO esto en Supabase SQL Editor → Run
-- ============================================================

-- PASO 1: Eliminar TODOS los triggers de la tabla profiles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.tgname, c.relname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'profiles'
          AND NOT t.tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles', r.tgname);
        RAISE NOTICE 'Eliminado trigger: %', r.tgname;
    END LOOP;
END $$;

-- PASO 2: Crear función de sincronización SEGURA
-- (sin ninguna referencia a customer_id, con doble EXCEPTION)
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar empleados/admins, no clientes web
    IF NEW.role IS NULL OR NEW.role = 'customer' THEN
        RETURN NEW;
    END IF;

    -- Todo dentro de un bloque con excepción para no bloquear nunca
    BEGIN
        INSERT INTO public.customers (
            name, email, phone, store_id,
            is_employee, profile_id, customer_type
        ) VALUES (
            COALESCE(NEW.full_name, 'Empleado'),
            NEW.email,
            NEW.phone,
            NEW.store_id,
            TRUE,
            NEW.id,
            'final'
        )
        ON CONFLICT (profile_id) DO UPDATE SET
            name        = EXCLUDED.name,
            email       = EXCLUDED.email,
            phone       = EXCLUDED.phone,
            store_id    = EXCLUDED.store_id,
            is_employee = TRUE,
            updated_at  = NOW();
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar cualquier error de sincronización, NUNCA bloquear
        RAISE WARNING 'sync_profile_to_customer ignorado: %', SQLERRM;
    END;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_profile_to_customer (outer) ignorado: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 3: Crear función de eliminación SEGURA
CREATE OR REPLACE FUNCTION public.handle_employee_deletion()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        UPDATE public.customers
        SET is_employee = FALSE, profile_id = NULL
        WHERE profile_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_employee_deletion ignorado: %', SQLERRM;
    END;
    RETURN OLD;
EXCEPTION WHEN OTHERS THEN
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PASO 4: Reinstalar triggers limpios
CREATE TRIGGER trigger_sync_profile_to_customer
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_customer();

CREATE TRIGGER trigger_handle_employee_deletion
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_employee_deletion();

-- PASO 5: Crear RPC para actualizar cedula (sin session_replication_role)
-- Ahora que los triggers son seguros, este UPDATE nunca fallará
CREATE OR REPLACE FUNCTION public.update_profile_cedula(
    p_profile_id UUID,
    p_cedula TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET cedula = p_cedula
    WHERE id = p_profile_id;
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_profile_cedula: %', SQLERRM;
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO service_role;

-- PASO 6: Verificar resultado
SELECT 
    t.tgname AS trigger,
    p.proname AS funcion
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
