-- ==============================================================================
-- MIGRACIÓN: EXCLUIR EMPLEADOS DEL PANEL MAESTRO Y LIMPIAR TIENDAS FANTASMA
-- ==============================================================================

-- 1. Actualizar get_all_stores_admin para que solo devuelva empresas reales creadas por sus dueños
CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    store_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    owner_email TEXT,
    plan_name TEXT,
    plan_end_date TIMESTAMP WITH TIME ZONE,
    plan_status TEXT
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
        p.email as owner_email,
        COALESCE(sp.name, 'Sin Plan') as plan_name,
        sub.end_date as plan_end_date,
        sub.status as plan_status
    FROM public.stores s
    JOIN public.profiles p ON s.owner_id = p.id
    LEFT JOIN LATERAL (
        SELECT cs.plan_id, cs.status, cs.end_date
        FROM public.company_subscriptions cs
        WHERE cs.company_id = s.id
        ORDER BY cs.created_at DESC
        LIMIT 1
    ) sub ON true
    LEFT JOIN public.subscription_plans sp ON sub.plan_id = sp.id
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

-- 2. Limpieza segura de tiendas fantasma/dummy generadas automáticamente para cuentas de empleados
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT s.id 
        FROM public.stores s
        JOIN public.profiles p ON s.owner_id = p.id
        WHERE p.store_id IS NOT NULL 
          AND p.store_id <> s.id
          AND s.store_name LIKE 'Mi Comercio USR-%'
          AND NOT EXISTS (SELECT 1 FROM public.sales sl WHERE sl.store_id = s.id)
    ) LOOP
        -- Eliminar dependencias de la tienda fantasma
        DELETE FROM public.company_subscriptions WHERE company_id = r.id;
        DELETE FROM public.company_settings WHERE store_id = r.id;
        DELETE FROM public.store_settings WHERE store_id = r.id;
        DELETE FROM public.categories WHERE store_id = r.id;
        DELETE FROM public.invoice_sequences WHERE store_id = r.id;
        DELETE FROM public.stores WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Actualizar trigger handle_new_user para que no genere tiendas cuando se registren empleados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id      UUID;
  new_user_number   TEXT;
  new_store_code    TEXT;
  new_slug          TEXT;
  company_name_val  TEXT;
  v_plan_id         TEXT;
  counter           INTEGER;
  v_is_employee     BOOLEAN;
  v_target_store_id UUID;
BEGIN
  -- A. Detectar si el usuario es un empleado de un comercio existente
  v_is_employee := COALESCE((NEW.raw_user_meta_data ->> 'is_employee')::boolean, false);
  IF (NEW.raw_user_meta_data ->> 'store_id') IS NOT NULL THEN
    BEGIN
      v_target_store_id := (NEW.raw_user_meta_data ->> 'store_id')::uuid;
      v_is_employee := true;
    EXCEPTION WHEN OTHERS THEN
      v_target_store_id := NULL;
    END;
  END IF;

  -- Número de usuario único
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- SI ES EMPLEADO: crear únicamente su perfil y rol, SIN tienda ni suscripción propia
  IF v_is_employee THEN
    INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Empleado'),
      new_user_number,
      v_target_store_id,
      COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'),
      true
    )
    ON CONFLICT (id) DO UPDATE
      SET store_id = COALESCE(EXCLUDED.store_id, profiles.store_id),
          role = COALESCE(EXCLUDED.role, profiles.role);

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

  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Usuario'),
    new_user_number,
    new_store_id,
    'admin',
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET store_id = new_store_id;

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

  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val)
  ON CONFLICT DO NOTHING;

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

NOTIFY pgrst, 'reload schema';
