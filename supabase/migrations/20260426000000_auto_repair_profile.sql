CREATE OR REPLACE FUNCTION public.auto_repair_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_user_name TEXT;
  v_new_store_id UUID;
  v_user_number TEXT;
  v_store_code TEXT;
  v_slug TEXT;
  v_counter INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    -- Generate Numbers
    SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1 INTO v_counter FROM public.profiles WHERE user_number LIKE 'USR-%';
    v_user_number := 'USR-' || LPAD(v_counter::TEXT, 6, '0');
    v_store_code := substring(md5(random()::text) from 1 for 6);
    v_slug := 'comercio-' || lower(v_store_code);

    -- 1. Create Store
    INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
    VALUES ('Mi Comercio', v_store_code, v_slug, v_user_id, true)
    RETURNING id INTO v_new_store_id;

    -- 2. Create Profile
    INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
    VALUES (v_user_id, v_user_email, 'Usuario Recuperado', v_user_number, v_new_store_id, 'owner', true);
    
    -- 3. Required Settings
    INSERT INTO public.company_settings (store_id, company_name) VALUES (v_new_store_id, 'Mi Comercio');
    INSERT INTO public.store_settings (store_id) VALUES (v_new_store_id);
    
    -- 4. Set Admin Role
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin') ON CONFLICT DO NOTHING;

    -- 5. Subscriptions
    INSERT INTO public.company_subscriptions (company_id, plan_id, status, start_date, end_date, payment_method)
    VALUES (v_new_store_id, 'basic', 'active', now(), now() + INTERVAL '14 days', 'trial');

    RETURN true;
  END IF;

  RETURN false;
END;
$$;
