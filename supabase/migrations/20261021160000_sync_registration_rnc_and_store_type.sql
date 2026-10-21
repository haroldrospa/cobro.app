-- ==============================================================================
-- Migración: Sincronizar RNC, teléfono y tipo de comercio en registro y SuperAdmin
-- ==============================================================================

-- 1. Sincronizar RNC y teléfono hacia company_settings desde los metadatos de auth.users si están vacíos
DO $$
BEGIN
    -- Sincronizar RNC en company_settings
    UPDATE public.company_settings cs
    SET rnc = NULLIF(TRIM(u.raw_user_meta_data ->> 'rnc'), '')
    FROM public.stores s
    JOIN auth.users u ON s.owner_id = u.id
    WHERE cs.store_id = s.id
      AND (cs.rnc IS NULL OR cs.rnc = '')
      AND NULLIF(TRIM(u.raw_user_meta_data ->> 'rnc'), '') IS NOT NULL;

    -- Sincronizar teléfono en company_settings
    UPDATE public.company_settings cs
    SET phone = NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'phone', u.phone)), '')
    FROM public.stores s
    JOIN auth.users u ON s.owner_id = u.id
    WHERE cs.store_id = s.id
      AND (cs.phone IS NULL OR cs.phone = '')
      AND NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'phone', u.phone)), '') IS NOT NULL;

    -- Sincronizar teléfono en profiles
    UPDATE public.profiles p
    SET phone = NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'phone', u.phone)), '')
    FROM auth.users u
    WHERE p.id = u.id
      AND (p.phone IS NULL OR p.phone = '')
      AND NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'phone', u.phone)), '') IS NOT NULL;

    -- Sincronizar shop_type en store_settings
    UPDATE public.store_settings ss
    SET shop_type = NULLIF(TRIM(u.raw_user_meta_data ->> 'shop_type'), '')
    FROM public.stores s
    JOIN auth.users u ON s.owner_id = u.id
    WHERE ss.store_id = s.id
      AND (ss.shop_type IS NULL OR ss.shop_type = '' OR ss.shop_type = 'general')
      AND NULLIF(TRIM(u.raw_user_meta_data ->> 'shop_type'), '') IS NOT NULL;
END $$;

-- 2. Actualizar el trigger handle_new_user para persistir RNC, teléfono y tipo de comercio desde el inicio
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  company_name_val TEXT;
  new_store_id     UUID;
  new_store_code   TEXT;
  new_slug         TEXT;
  counter          INTEGER;
  new_user_number  TEXT;
  v_plan_id        TEXT;
  v_is_employee    BOOLEAN;
  v_target_store_id UUID;
  v_phone          TEXT;
  v_rnc            TEXT;
BEGIN
  -- Verificar si el usuario que se registra es un empleado invitado
  v_is_employee := COALESCE((NEW.raw_user_meta_data ->> 'is_employee')::BOOLEAN, false);
  IF v_is_employee AND NEW.raw_user_meta_data ->> 'store_id' IS NOT NULL THEN
    v_target_store_id := (NEW.raw_user_meta_data ->> 'store_id')::UUID;
  ELSE
    v_target_store_id := NULL;
  END IF;

  -- Número de usuario único
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');
  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone)), '');
  v_rnc   := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'rnc'), '');

  -- SI ES EMPLEADO: crear únicamente su perfil y rol, SIN tienda ni suscripción propia
  IF v_is_employee THEN
    INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Empleado'),
      new_user_number,
      v_target_store_id,
      COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'),
      true,
      v_phone
    )
    ON CONFLICT (id) DO UPDATE
      SET store_id = COALESCE(EXCLUDED.store_id, profiles.store_id),
          role = COALESCE(EXCLUDED.role, profiles.role),
          phone = COALESCE(EXCLUDED.phone, profiles.phone);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  -- SI ES DUEÑO DE COMERCIO: crear tienda, perfil, suscripción y configuraciones habituales
  company_name_val := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), ''),
    'Mi Comercio ' || new_user_number
  );

  v_plan_id := COALESCE(NEW.raw_user_meta_data ->> 'plan_id', 'basic');
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    v_plan_id := 'basic';
  END IF;

  new_store_code := public.generate_store_code();
  new_slug       := public.generate_store_slug(company_name_val, new_store_code);

  IF EXISTS (SELECT 1 FROM public.stores WHERE slug = new_slug) THEN
    new_store_code := public.generate_store_code();
    new_slug       := public.generate_store_slug(company_name_val, new_store_code);
  END IF;

  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Usuario'),
    new_user_number,
    new_store_id,
    'admin',
    true,
    v_phone
  )
  ON CONFLICT (id) DO UPDATE
    SET store_id = new_store_id,
        phone = COALESCE(EXCLUDED.phone, profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_subscriptions (
    company_id, plan_id, status, start_date, end_date, payment_method
  )
  VALUES (
    new_store_id, v_plan_id, 'active',
    now(), now() + INTERVAL '15 days',
    'trial'
  );

  INSERT INTO public.company_settings (store_id, company_name, phone, rnc)
  VALUES (new_store_id, company_name_val, v_phone, v_rnc)
  ON CONFLICT (store_id) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        phone = COALESCE(EXCLUDED.phone, company_settings.phone),
        rnc = COALESCE(EXCLUDED.rnc, company_settings.rnc);

  INSERT INTO public.store_settings (store_id, shop_type)
  VALUES (new_store_id, COALESCE(NEW.raw_user_meta_data ->> 'shop_type', 'store'))
  ON CONFLICT (store_id) DO UPDATE 
    SET shop_type = EXCLUDED.shop_type;

  INSERT INTO public.categories (name, description, store_id) VALUES
    ('General',  'Productos generales',   new_store_id),
    ('Bebidas',  'Bebidas y líquidos',    new_store_id),
    ('Comida',   'Alimentos preparados',  new_store_id),
    ('Snacks',   'Bocadillos',            new_store_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
  VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id),
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user FAILED for user %: SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Actualizar get_all_stores_admin() para retornar también rnc y shop_type
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
    rnc TEXT,
    shop_type TEXT,
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
            NULLIF(TRIM(u.phone), ''),
            NULLIF(TRIM((
                SELECT csr.contact_phone 
                FROM public.client_support_reports csr 
                WHERE csr.store_id = s.id AND csr.contact_phone IS NOT NULL AND csr.contact_phone <> ''
                ORDER BY csr.created_at DESC 
                LIMIT 1
            )), ''),
            ''
        ) as owner_phone,
        COALESCE(
            NULLIF(TRIM(cs_set.rnc), ''),
            NULLIF(TRIM(u.raw_user_meta_data ->> 'rnc'), ''),
            ''
        ) as rnc,
        COALESCE(
            NULLIF(TRIM(ss_set.shop_type), ''),
            NULLIF(TRIM(u.raw_user_meta_data ->> 'shop_type'), ''),
            'store'
        ) as shop_type,
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
    LEFT JOIN public.store_settings ss_set ON ss_set.store_id = s.id
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
        -- A. El perfil del usuario debe pertenecer a este mismo comercio (no ser empleado de otra empresa)
        (p.store_id IS NULL OR p.store_id = s.id)
        -- B. No debe tener rol subordinado de empleado en el sistema
        AND (p.role IS NULL OR p.role NOT IN ('cashier', 'staff', 'kitchen', 'delivery', 'accountant'))
        -- C. No debe estar registrado como empleado de otra tienda
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

NOTIFY pgrst, 'reload schema';
