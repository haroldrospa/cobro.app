-- ============================================================================
-- SCRIPT DE ACTUALIZACIÓN: TIPO DE NEGOCIO AL REGISTRO Y 15 DÍAS DE PRUEBA (CON AUTO-REPAIR ROBUSTO)
-- Ejecuta este script en el editor SQL de Supabase para actualizar la base de datos.
-- ============================================================================

-- 1. Actualizar la función handle_new_user
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
BEGIN
  -- A. Número de usuario único
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- B. Datos del registro
  company_name_val := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), ''),
    'Mi Comercio ' || new_user_number
  );

  -- Validate plan_id: only accept known IDs, otherwise fall back to 'basic'
  v_plan_id := COALESCE(NEW.raw_user_meta_data ->> 'plan_id', 'basic');
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    RAISE LOG 'handle_new_user: unknown plan_id %, falling back to basic', v_plan_id;
    v_plan_id := 'basic';
  END IF;

  -- C. Códigos de tienda
  new_store_code := public.generate_store_code();
  new_slug       := public.generate_store_slug(company_name_val, new_store_code);

  -- Ensure slug is unique
  IF EXISTS (SELECT 1 FROM public.stores WHERE slug = new_slug) THEN
    new_store_code := public.generate_store_code();
    new_slug       := public.generate_store_slug(company_name_val, new_store_code);
  END IF;

  -- D. Tienda
  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  -- E. Perfil
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Usuario'),
    new_user_number,
    new_store_id,
    'admin',
    true
  );

  -- F. Rol
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- G. Suscripción (15 Días Gratis)
  INSERT INTO public.company_subscriptions (
    company_id, plan_id, status, start_date, end_date, payment_method
  )
  VALUES (
    new_store_id, v_plan_id, 'active',
    now(), now() + INTERVAL '15 days',
    'trial'
  );

  -- H. Configuraciones (Con Tipo de Negocio/Shop Type guardado desde el registro)
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.store_settings (store_id, shop_type)
  VALUES (new_store_id, COALESCE(NEW.raw_user_meta_data ->> 'shop_type', 'store'))
  ON CONFLICT (store_id) DO UPDATE 
    SET shop_type = EXCLUDED.shop_type;

  -- I. Categorías por defecto
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('General',  'Productos generales',   new_store_id),
    ('Bebidas',  'Bebidas y líquidos',    new_store_id),
    ('Comida',   'Alimentos preparados',  new_store_id),
    ('Snacks',   'Bocadillos',            new_store_id)
  ON CONFLICT DO NOTHING;

  -- J. Secuencias de facturación
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
  VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id),
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id)
  ON CONFLICT DO NOTHING;

  RAISE LOG 'handle_new_user: profile created successfully for user % (store %)', NEW.id, new_store_id;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user FAILED for user %: SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Asegurarse de que el trigger esté adjunto correctamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Actualizar la función de autoreparación auto_repair_profile (Versión robusta para usuarios existentes sin tienda)
CREATE OR REPLACE FUNCTION public.auto_repair_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_user_email   TEXT;
  v_user_name    TEXT;
  v_company_name TEXT;
  v_new_store_id UUID;
  v_user_number  TEXT;
  v_store_code   TEXT;
  v_slug         TEXT;
  v_counter      INTEGER;
  v_shop_type    TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Ya tiene un perfil y tiene una tienda válida? No requiere reparación
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.stores s ON p.store_id = s.id
    WHERE p.id = v_user_id
  ) THEN
    RETURN false;
  END IF;

  SELECT email, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'company_name', raw_user_meta_data ->> 'shop_type'
    INTO v_user_email, v_user_name, v_company_name, v_shop_type
    FROM auth.users
   WHERE id = v_user_id;

  -- Intentar recuperar una tienda existente de este dueño
  SELECT id INTO v_new_store_id 
    FROM public.stores 
   WHERE owner_id = v_user_id 
   LIMIT 1;

  v_company_name := COALESCE(NULLIF(TRIM(v_company_name), ''), 'Mi Comercio');

  IF v_new_store_id IS NULL THEN
    v_store_code  := upper(substring(md5(random()::text) from 1 for 6));
    v_slug        := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9\s]', '', 'g'));
    v_slug        := regexp_replace(v_slug, '\s+', '-', 'g') || '-' || lower(v_store_code);

    INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
    VALUES (v_company_name, v_store_code, v_slug, v_user_id, true)
    RETURNING id INTO v_new_store_id;
  END IF;

  -- Buscar o generar user_number si no tiene perfil
  SELECT user_number INTO v_user_number 
    FROM public.profiles 
   WHERE id = v_user_id;

  IF v_user_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
      INTO v_counter
      FROM public.profiles
     WHERE user_number LIKE 'USR-%';
    v_user_number := 'USR-' || LPAD(v_counter::TEXT, 6, '0');
  END IF;

  -- Crear o actualizar perfil con la tienda
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    v_user_id,
    v_user_email,
    COALESCE(NULLIF(TRIM(v_user_name), ''), 'Usuario'),
    v_user_number,
    v_new_store_id,
    'admin',
    true
  )
  ON CONFLICT (id) DO UPDATE 
    SET store_id = v_new_store_id,
        role = COALESCE(profiles.role, 'admin');

  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (v_new_store_id, v_company_name)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.store_settings (store_id, shop_type)
  VALUES (v_new_store_id, COALESCE(v_shop_type, 'store'))
  ON CONFLICT (store_id) DO UPDATE 
    SET shop_type = EXCLUDED.shop_type;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
  VALUES (v_new_store_id, 'basic', 'active', now(), now() + INTERVAL '15 days', 'trial')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
  VALUES
    ('B01', 0, v_new_store_id), ('B02', 0, v_new_store_id),
    ('B03', 0, v_new_store_id), ('B14', 0, v_new_store_id),
    ('B15', 0, v_new_store_id), ('B16', 0, v_new_store_id)
  ON CONFLICT DO NOTHING;

  RAISE LOG 'auto_repair_profile: repaired profile for user %', v_user_id;
  RETURN true;
END;
$$;
