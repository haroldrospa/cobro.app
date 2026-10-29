-- Añadir columnas para almacenar llaves de API pública de RecargameYa
ALTER TABLE public.digital_services_config
ADD COLUMN IF NOT EXISTS api_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS api_secret TEXT DEFAULT NULL;

-- Asegurar políticas de seguridad para que solo administradores puedan actualizar las llaves
DROP POLICY IF EXISTS "Admins can update digital services config" ON public.digital_services_config;
CREATE POLICY "Admins can update digital services config"
    ON public.digital_services_config
    FOR ALL
    TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());
