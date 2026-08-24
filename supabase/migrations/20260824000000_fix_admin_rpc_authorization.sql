-- ═══════════════════════════════════════════════════════════════════
-- URGENTE — cierra un hueco de seguridad real: las funciones admin de
-- abajo (SECURITY DEFINER) no verificaban quién las llamaba. Cualquier
-- usuario autenticado normal podía invocarlas directo (get_all_stores_admin,
-- delete_store_and_owner, etc.) sin pasar por "Panel Maestro" ni por
-- ninguna contraseña.
--
-- Este archivo SOLO crea la función helper is_platform_admin() -- eso es
-- 100% seguro y aditivo, no toca nada existente. El resto (agregar la
-- verificación dentro de cada función admin) hay que hacerlo a mano por
-- Dashboard → Database → Functions, editando cada una para no arriesgarnos
-- a que la versión de este repo no coincida exactamente con la que está
-- viva en producción. Instrucciones abajo del todo.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IN ('haroldrospa@gmail.com', 'cobroapp@cobroapp.com')
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Verifica si el usuario autenticado actual es administrador de la plataforma (no de una tienda individual -- el rol "owner"/"admin" de profiles.role es por tienda, no sirve para esto). Usar como guardia al inicio de toda función SECURITY DEFINER de alcance multi-tienda.';

-- No revocar/otorgar permisos de ejecución de las 6 funciones admin acá --
-- eso rompería el panel para el admin real hasta que cada una tenga su
-- guardia agregada (paso manual, ver abajo).
