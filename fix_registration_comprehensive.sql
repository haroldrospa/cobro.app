-- Comprehensive fix for the new user registration flow
-- Combines profile creation, store initialization, subscription setup, and sequence initialization.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id UUID;
  new_user_number TEXT;
  new_store_code TEXT;
  new_slug TEXT;
  company_name_val TEXT;
  counter INTEGER;
  v_plan_id TEXT;
BEGIN
  -- 1. Generate User Number (USR-XXXXXX)
  -- Uses a simple counter based on existing profiles
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- 2. Extract Company Name from meta data
  company_name_val := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Mi Comercio ' || new_user_number);

  -- 3. Generate Store Code and Slug
  -- Need to ensure these functions exist. If not, we fallback to random.
  -- Assuming generate_store_code and generate_store_slug exist from previous migrations.
  -- If they might not exist, we can use simple generation here to be safe.
  new_store_code := 'ST-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Simple slug generation
  new_slug := LOWER(REGEXP_REPLACE(company_name_val, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || LOWER(new_store_code);

  -- 4. Create Store
  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  -- 5. Create Profile linked to the new store
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    new_user_number,
    new_store_id,
    'owner',
    true
  );
  
  -- 6. Assign Role in user_roles table (Security measure)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- 7. Initialize Company Settings
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val);

  -- 8. Initialize Store Settings
  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id);

  -- 9. Initialize Subscription
  v_plan_id := NEW.raw_user_meta_data->>'plan_id';
  IF v_plan_id IS NULL THEN v_plan_id := 'basic'; END IF;

  INSERT INTO public.company_subscriptions (
      company_id, 
      plan_id, 
      status, 
      start_date, 
      end_date,
      payment_method
  )
  VALUES (
      new_store_id, 
      v_plan_id, 
      'active', -- Active trial
      now(), 
      now() + INTERVAL '14 days',
      'trial'
  );

  -- 10. Initialize Default Categories
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('General', 'Categoría general', new_store_id),
    ('Bebidas', 'Bebidas y líquidos', new_store_id),
    ('Comida', 'Alimentos preparados', new_store_id);

  -- 11. Initialize Default Invoice Sequences safely
  -- Look up invoice types by code to avoid UUID casting errors
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
  SELECT id, 0, new_store_id
  FROM public.invoice_types
  WHERE code IN ('B01', 'B02', 'B03', 'B14', 'B15', 'B16');
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error for debugging in Supabase dashboard
  RAISE LOG 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
  -- Reraise the error so the user sees it in the frontend
  RAISE EXCEPTION 'Database error saving new user: %', SQLERRM;
END;
$$;
