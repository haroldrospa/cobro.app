-- ============================================================
-- SOLUCIÓN DEFINITIVA: RPC para actualizar cédula de empleados
-- sin disparar los triggers problemáticos de profiles.
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase → SQL Editor
-- 2. Pega TODO este contenido
-- 3. Presiona Run
-- ============================================================

-- Función RPC que actualiza la cédula directamente,
-- usando session_replication_role = replica para evitar
-- que se disparen triggers problemáticos en profiles.
CREATE OR REPLACE FUNCTION public.update_profile_cedula(
    p_profile_id UUID,
    p_cedula TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET session_replication_role = replica
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

-- Dar permiso a usuarios autenticados para llamar esta función
GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO service_role;

-- Verificar que la función fue creada correctamente
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_profile_cedula';
