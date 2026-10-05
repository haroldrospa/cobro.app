-- ==============================================================================
-- Migración: Actualizar teléfono de clientes en SuperAdmin y sincronizar con auth
-- ==============================================================================

-- 1. Sincronizar teléfonos existentes desde auth.users.raw_user_meta_data si faltan en profiles o company_settings
DO $$
BEGIN
    -- Actualizar perfiles que no tienen teléfono
    UPDATE public.profiles p
    SET phone = NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), '')
    FROM auth.users u
    WHERE p.id = u.id
      AND (p.phone IS NULL OR p.phone = '')
      AND NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), '') IS NOT NULL;

    -- Actualizar company_settings de la tienda si no tiene teléfono
    UPDATE public.company_settings cs
    SET phone = NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), '')
    FROM public.stores s
    JOIN auth.users u ON s.owner_id = u.id
    WHERE cs.store_id = s.id
      AND (cs.phone IS NULL OR cs.phone = '')
      AND NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), '') IS NOT NULL;
END $$;

-- 2. Función para que el SuperAdmin pueda actualizar el teléfono de un cliente
CREATE OR REPLACE FUNCTION public.admin_update_client_phone(
    p_store_id UUID,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_owner_id UUID;
    v_clean_phone TEXT;
BEGIN
    -- Validar permisos de SuperAdmin
    IF NOT public.is_platform_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Acceso denegado: se requieren permisos de SuperAdmin.');
    END IF;

    v_clean_phone := NULLIF(TRIM(p_phone), '');

    -- Obtener el ID del propietario de la tienda
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró la tienda o propietario asociado.');
    END IF;

    -- 1. Actualizar en profiles
    UPDATE public.profiles
    SET phone = v_clean_phone
    WHERE id = v_owner_id OR store_id = p_store_id;

    -- 2. Actualizar en company_settings
    INSERT INTO public.company_settings (store_id, company_name, phone)
    VALUES (p_store_id, 'Mi Negocio', v_clean_phone)
    ON CONFLICT (store_id) DO UPDATE
    SET phone = EXCLUDED.phone;

    -- 3. Actualizar metadatos en auth.users
    IF v_clean_phone IS NOT NULL THEN
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', v_clean_phone)
        WHERE id = v_owner_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'phone', v_clean_phone, 'message', 'Teléfono actualizado correctamente.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_client_phone(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_client_phone(UUID, TEXT) TO service_role;

-- 3. Actualizar get_all_stores_admin para recuperar teléfono con fallback a auth.users y reportes
DROP FUNCTION IF EXISTS public.get_all_stores_admin();

CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    store_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    owner_email TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    plan_name TEXT,
    plan_end_date TIMESTAMP WITH TIME ZONE,
    plan_status TEXT,
    reports_count BIGINT,
    latest_follow_up_status TEXT,
    latest_follow_up_note TEXT,
    latest_follow_up_date TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Validar permisos de SuperAdmin
    IF NOT public.is_platform_admin() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.store_name,
        s.store_code,
        s.is_active,
        s.created_at,
        COALESCE(p.email, u.email) as owner_email,
        COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''), 'Usuario') as owner_name,
        COALESCE(
            NULLIF(TRIM(p.phone), ''), 
            NULLIF(TRIM(cs_set.phone), ''), 
            NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), ''),
            NULLIF(TRIM((
                SELECT csr.contact_phone 
                FROM public.client_support_reports csr 
                WHERE csr.store_id = s.id AND csr.contact_phone IS NOT NULL AND csr.contact_phone <> ''
                ORDER BY csr.created_at DESC 
                LIMIT 1
            )), ''),
            ''
        ) as owner_phone,
        COALESCE(sub.plan_id, 'basic') as plan_name,
        sub.end_date as plan_end_date,
        sub.status as plan_status,
        (
            COALESCE((SELECT COUNT(*) FROM public.client_support_reports csr WHERE csr.store_id = s.id), 0) +
            COALESCE((SELECT COUNT(*) FROM public.payment_reports pr WHERE pr.company_id = s.id), 0)
        )::BIGINT as reports_count,
        latest_fu.status as latest_follow_up_status,
        latest_fu.client_feedback as latest_follow_up_note,
        latest_fu.created_at as latest_follow_up_date
    FROM public.stores s
    JOIN public.profiles p ON s.owner_id = p.id
    LEFT JOIN auth.users u ON s.owner_id = u.id
    LEFT JOIN public.company_settings cs_set ON cs_set.store_id = s.id
    LEFT JOIN LATERAL (
        SELECT cs.plan_id, cs.status, cs.end_date
        FROM public.company_subscriptions cs
        WHERE cs.company_id = s.id
        ORDER BY cs.created_at DESC
        LIMIT 1
    ) sub ON true
    LEFT JOIN LATERAL (
        SELECT fn.status, fn.client_feedback, fn.created_at
        FROM public.client_follow_up_notes fn
        WHERE fn.store_id = s.id
        ORDER BY fn.created_at DESC
        LIMIT 1
    ) latest_fu ON true
    WHERE 
        (p.store_id IS NULL OR p.store_id = s.id)
        AND (p.role IS NULL OR p.role NOT IN ('cashier', 'staff', 'kitchen', 'delivery', 'accountant'))
        AND NOT EXISTS (
            SELECT 1 FROM public.profiles emp_p
            WHERE emp_p.id = s.owner_id
              AND emp_p.store_id IS NOT NULL 
              AND emp_p.store_id <> s.id
        )
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_stores_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_stores_admin() TO service_role;
