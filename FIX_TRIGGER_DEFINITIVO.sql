-- ============================================================
-- FIX DEFINITIVO: Error "record 'new' has no field 'customer_id'"
-- Copia y pega TODO este SQL en Supabase SQL Editor y presiona Run
-- ============================================================

-- PASO 1: Ver qué triggers existen actualmente en profiles
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== TRIGGERS EN TABLA profiles ===';
    FOR r IN 
        SELECT trigger_name, event_manipulation, action_timing
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public'
          AND event_object_table = 'profiles'
        ORDER BY trigger_name, event_manipulation
    LOOP
        RAISE NOTICE 'Trigger: % | Evento: % | Timing: %', r.trigger_name, r.event_manipulation, r.action_timing;
    END LOOP;
END $$;

-- PASO 2: ELIMINAR TODOS los triggers problemáticos de profiles
DROP TRIGGER IF EXISTS trigger_sync_profile_to_customer ON public.profiles;
DROP TRIGGER IF EXISTS trigger_handle_employee_deletion ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_employee_to_customer ON public.profiles;
DROP TRIGGER IF EXISTS sync_employee_customer ON public.profiles;
DROP TRIGGER IF EXISTS update_profile_customer ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- PASO 3: Ver si customer_id existe en profiles
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'customer_id'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'ENCONTRADO: customer_id SÍ existe en profiles - procediendo a eliminarla';
    ELSE
        RAISE NOTICE 'OK: customer_id NO existe en profiles';
    END IF;
END $$;

-- PASO 4: Eliminar customer_id de profiles si existe (con CASCADE para borrar índices/constraints dependientes)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS customer_id CASCADE;

-- PASO 5: Recrear la función sync_profile_to_customer con manejo de errores a prueba de balas
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Salir inmediatamente si es cliente web (no empleado)
    IF NEW.role IS NULL OR NEW.role = 'customer' THEN
        RETURN NEW;
    END IF;

    -- Intentar sincronizar con EXCEPTION para que NUNCA bloquee un UPDATE
    BEGIN
        -- Verificar si la tabla customers tiene la columna profile_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'customers'
              AND column_name = 'profile_id'
        ) THEN
            INSERT INTO public.customers (
                name, email, phone, store_id, is_employee, profile_id, customer_type
            )
            VALUES (
                COALESCE(NEW.full_name, 'Empleado'),
                NEW.email,
                NEW.phone,
                NEW.store_id,
                TRUE,
                NEW.id,
                'final'
            )
            ON CONFLICT (profile_id) DO UPDATE SET
                name       = EXCLUDED.name,
                email      = EXCLUDED.email,
                phone      = EXCLUDED.phone,
                store_id   = EXCLUDED.store_id,
                is_employee = TRUE,
                updated_at = NOW();
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Registrar el error pero NUNCA bloquear el UPDATE del perfil
        RAISE WARNING 'sync_profile_to_customer: error ignorado: %', SQLERRM;
    END;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Capa extra de seguridad
    RAISE WARNING 'sync_profile_to_customer (outer): error ignorado: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 6: Reinstalar SOLO el trigger de sincronización (con manejo seguro)
CREATE TRIGGER trigger_sync_profile_to_customer
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_customer();

-- PASO 7: Recrear trigger de eliminación de empleados (también seguro)
CREATE OR REPLACE FUNCTION public.handle_employee_deletion()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'customers'
              AND column_name = 'profile_id'
        ) THEN
            UPDATE public.customers 
            SET is_employee = FALSE, profile_id = NULL 
            WHERE profile_id = OLD.id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_employee_deletion: error ignorado: %', SQLERRM;
    END;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_handle_employee_deletion
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_employee_deletion();

-- PASO 8: Verificación final
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
  AND event_object_table = 'profiles'
ORDER BY trigger_name, event_manipulation;

-- Verificar columnas de profiles (confirmar que customer_id no está)
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('cedula', 'customer_id', 'credit_limit', 'is_active')
ORDER BY column_name;
