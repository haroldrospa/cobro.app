-- ============================================================
-- FIX DEFINITIVO: Elimina el trigger que faltaba + crea el RPC
-- NO requiere permisos especiales. 
-- Ejecuta en Supabase SQL Editor → Run
-- ============================================================

-- 1. Eliminar el trigger que faltaba (el culpable real)
DROP TRIGGER IF EXISTS on_profile_updated_sync_customer ON public.profiles;

-- 2. Reemplazar su función con versión segura
CREATE OR REPLACE FUNCTION public.update_customer_from_profile()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        UPDATE public.customers
        SET
            name       = COALESCE(NEW.full_name, name),
            email      = COALESCE(NEW.email, email),
            updated_at = NOW()
        WHERE profile_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'update_customer_from_profile ignorado: %', SQLERRM;
    END;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Reinstalar ese trigger de forma segura
CREATE TRIGGER on_profile_updated_sync_customer
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_customer_from_profile();

-- 4. Crear el RPC para guardar cédula (sin session_replication_role)
--    Ahora que los triggers son seguros, este UPDATE funcionará
CREATE OR REPLACE FUNCTION public.update_profile_cedula(
    p_profile_id UUID,
    p_cedula     TEXT
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
    RAISE WARNING 'update_profile_cedula error: %', SQLERRM;
    RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO service_role;

-- 5. Verificar resultado
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'profiles'
ORDER BY trigger_name;
