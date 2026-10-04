-- ==============================================================================
-- Función para que el SuperAdmin pueda asignar o cambiar la contraseña de un cliente
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_set_user_password(
    p_store_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_owner_id UUID;
    v_encrypted TEXT;
BEGIN
    -- 1. Verificar si el usuario autenticado es SuperAdmin de la plataforma
    IF NOT public.is_platform_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Acceso denegado: se requieren permisos de SuperAdmin.');
    END IF;

    -- 2. Validar que la contraseña cumpla los requisitos mínimos
    IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres.');
    END IF;

    -- 3. Obtener el ID del propietario en auth.users
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró la tienda o el propietario asociado.');
    END IF;

    -- 4. Generar el hash bcrypt con factor de coste 10 compatible con GoTrue / Supabase Auth
    v_encrypted := extensions.crypt(trim(p_new_password), extensions.gen_salt('bf', 10));

    -- 5. Actualizar la contraseña en auth.users
    UPDATE auth.users
    SET encrypted_password = v_encrypted,
        updated_at = now()
    WHERE id = v_owner_id;

    RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada con éxito.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.admin_set_user_password(UUID, TEXT) IS
'Permite a los administradores de la plataforma reasignar la contraseña de acceso de cualquier cliente desde el Panel Maestro.';
