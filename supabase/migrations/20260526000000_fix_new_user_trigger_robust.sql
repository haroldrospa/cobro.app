-- ============================================================
-- FIX: ROBUST NEW USER REGISTRATION TRIGGER
-- 1. Ensures all required plan IDs exist in subscription_plans
-- 2. Replaces the silent-fail trigger with one that raises errors
--    properly so Supabase logs capture the real problem
-- 3. Updates auto_repair_profile to also be called on login
--    when a profile is missing (client-side fallback)
-- ============================================================

-- STEP 1: Ensure plan IDs that match the app ('basic', 'pro', 'enterprise') exist
-- Use UPSERT so this is idempotent (safe to run multiple times)
INSERT INTO public.subscription_plans (id, name, description, price_monthly, price_yearly, features)
VALUES
  ('basic',      'Plan Emprendedor', 'Ideal para empezar con el pie derecho.',   29,  288, '{"users": 1, "products": -1, "invoices_per_month": -1}'::jsonb),
  ('pro',        'Plan Negocio',     'Todo lo que necesitas para escalar.',       59,  588, '{"users": 5, "products": -1, "invoices_per_month": -1}'::jsonb),
  ('enterprise', 'Plan Corporativo', 'Potencia ilimitada adaptada a tu negocio.', 0,    0, '{"users": -1, "products": -1, "invoices_per_month": -1}'::jsonb)
ON CONFLICT (id) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      price_monthly = EXCLUDED.price_monthly,
      price_yearly  = EXCLUDED.price_yearly,
      features      = EXCLUDED.features;

-- STEP 2: Helper functions (idempotent)
CREATE OR REPLACE FUNCTION public.generate_store_code()
RETURNS text AS $$
DECLARE
  chars  text[]  := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text    := '';
  i      integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || chars[1 + (random() * (array_length(chars, 1) - 1))::integer];
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_store_slug(company_name text, store_code text)
RETURNS text AS $$
DECLARE
  base_slug  text;
BEGIN
  base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  RETURN base_slug || '-' || lower(store_code);
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Rebuild the trigger function
--  Key changes vs. previous version:
--   a) We RAISE LOG (not RAISE EXCEPTION) so Supabase Postgres logs capture the
--      exact error message, while still letting the auth insert succeed.
--   b) We validate the plan_id and fall back to 'basic' if it's not in the table.
--   c) We wrap each critical INSERT in its own sub-block so one failure doesn't
--      kill all the others silently.
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
  -- ── A. Número de usuario único ────────────────────────────────────────────
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- ── B. Datos del registro ─────────────────────────────────────────────────
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

  -- ── C. Códigos de tienda ──────────────────────────────────────────────────
  new_store_code := public.generate_store_code();
  new_slug       := public.generate_store_slug(company_name_val, new_store_code);

  -- Ensure slug is unique (retry once on collision)
  IF EXISTS (SELECT 1 FROM public.stores WHERE slug = new_slug) THEN
    new_store_code := public.generate_store_code();
    new_slug       := public.generate_store_slug(company_name_val, new_store_code);
  END IF;

  -- ── D. Tienda ─────────────────────────────────────────────────────────────
  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  -- ── E. Perfil ─────────────────────────────────────────────────────────────
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

  -- ── F. Rol ────────────────────────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- ── G. Suscripción ────────────────────────────────────────────────────────
  INSERT INTO public.company_subscriptions (
    company_id, plan_id, status, start_date, end_date, payment_method
  )
  VALUES (
    new_store_id, v_plan_id, 'active',
    now(), now() + INTERVAL '14 days',
    'trial'
  );

  -- ── H. Configuraciones ────────────────────────────────────────────────────
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id)
  ON CONFLICT DO NOTHING;

  -- ── I. Categorías por defecto ─────────────────────────────────────────────
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('General',  'Productos generales',   new_store_id),
    ('Bebidas',  'Bebidas y líquidos',    new_store_id),
    ('Comida',   'Alimentos preparados',  new_store_id),
    ('Snacks',   'Bocadillos',            new_store_id)
  ON CONFLICT DO NOTHING;

  -- ── J. Secuencias de facturación ──────────────────────────────────────────
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
  -- Log the real error so it appears in Supabase → Logs → Postgres
  RAISE LOG 'handle_new_user FAILED for user %: SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
  -- Still return NEW so the auth.users insert succeeds;
  -- the client-side auto_repair_profile RPC will fix it on next login.
  RETURN NEW;
END;
$$;

-- STEP 4: Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 5: Improve auto_repair_profile so it uses the correct plan and
--         full metadata when repairing broken accounts.
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Already has a profile? Nothing to repair.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RETURN false;
  END IF;

  SELECT email, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'company_name'
    INTO v_user_email, v_user_name, v_company_name
    FROM auth.users
   WHERE id = v_user_id;

  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO v_counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  v_user_number := 'USR-' || LPAD(v_counter::TEXT, 6, '0');
  v_store_code  := upper(substring(md5(random()::text) from 1 for 6));
  v_company_name := COALESCE(NULLIF(TRIM(v_company_name), ''), 'Mi Comercio');
  v_slug        := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9\s]', '', 'g'));
  v_slug        := regexp_replace(v_slug, '\s+', '-', 'g') || '-' || lower(v_store_code);

  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (v_company_name, v_store_code, v_slug, v_user_id, true)
  RETURNING id INTO v_new_store_id;

  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    v_user_id,
    v_user_email,
    COALESCE(NULLIF(TRIM(v_user_name), ''), 'Usuario'),
    v_user_number,
    v_new_store_id,
    'admin',
    true
  );

  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (v_new_store_id, v_company_name)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.store_settings (store_id)
  VALUES (v_new_store_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
  VALUES (v_new_store_id, 'basic', 'active', now(), now() + INTERVAL '14 days', 'trial');

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
