-- Función para obtener todas las tiendas (Super Admin)
CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    store_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    owner_email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.store_name,
        s.store_code,
        s.is_active,
        s.created_at,
        p.email as owner_email
    FROM public.stores s
    LEFT JOIN public.profiles p ON s.owner_id = p.id
    ORDER BY s.created_at DESC;
END;
$$;

-- Función para cambiar estado de tienda
CREATE OR REPLACE FUNCTION public.toggle_store_status(
    p_store_id UUID,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stores
    SET is_active = p_is_active
    WHERE id = p_store_id;

    -- También desactivar/activar el perfil del dueño si es necesario?
    -- Por ahora solo la tienda.

    RETURN jsonb_build_object('success', true, 'message', 'Estado actualizado');
END;
$$;
