-- =========================================================================
-- SOLUCIÓN AL ERROR DE RECURSIÓN RLS EN LA TABLA PROFILES
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- =========================================================================

-- 1. Crear una función segura para obtener el rol del usuario autenticado sin causar recursión
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_role TEXT;
BEGIN
    SELECT role INTO found_role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN found_role;
END;
$$;

-- 2. Redefinir la función is_admin_of_store_secure para evitar la recursión RLS
CREATE OR REPLACE FUNCTION public.is_admin_of_store_secure(lookup_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    public.get_auth_store_id() = lookup_store_id
    AND
    public.get_auth_role() IN ('admin', 'manager')
  );
END;
$$;

-- 3. Eliminar las políticas antiguas que generan la recursión infinita (error 400)
DROP POLICY IF EXISTS "Admins/Managers can update store profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Managers can view store profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see profiles from their same store" ON public.profiles;
DROP POLICY IF EXISTS "Store owners can view store members" ON public.profiles;
DROP POLICY IF EXISTS "Store owners can update store members" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 4. Crear nuevas políticas limpias, eficientes y seguras (no recursivas)
-- Política A: Lectura (Cualquier usuario autenticado puede ver los perfiles de su misma tienda o su propio perfil)
CREATE POLICY "Users can see profiles from their same store" 
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid() OR
    store_id = public.get_auth_store_id()
);

-- Política B: Actualización (Los usuarios pueden actualizar su propio perfil, o los administradores/gerentes pueden actualizar perfiles de su tienda)
CREATE POLICY "Admins/Managers can update store profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid() OR
    (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('admin', 'manager'))
)
WITH CHECK (
    id = auth.uid() OR
    (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('admin', 'manager'))
);

-- Política C: Inserción (Los administradores/gerentes pueden registrar perfiles, o los usuarios pueden insertar su propio perfil durante el registro)
CREATE POLICY "Admins/Managers can insert store profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid() OR
    (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('admin', 'manager'))
);

-- Política D: Eliminación (Solo los administradores/gerentes pueden eliminar perfiles de su tienda)
CREATE POLICY "Admins/Managers can delete store profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('admin', 'manager')
);

-- 5. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_auth_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of_store_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_store_secure TO service_role;

-- Mensaje de verificación
SELECT 'RLS Fix Applied successfully' as result;
