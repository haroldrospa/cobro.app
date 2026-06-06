-- ============================================================
-- 1. DROP LA FUNCIÓN ANTERIOR (por si acasi)
-- ============================================================
DROP FUNCTION IF EXISTS public.update_profile_cedula(UUID, TEXT);

-- ============================================================
-- 2. CREAR NUEVA VERSIÓN QUE MUESTRA EL ERROR REAL
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_cedula(
    p_profile_id UUID,
    p_cedula     TEXT
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET cedula = p_cedula
    WHERE id = p_profile_id;

    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    -- Retornamos el error exacto para verlo en la pantalla
    RETURN SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_cedula(UUID, TEXT) TO service_role;

SELECT 'NUEVA FUNCION CREADA' as status;
