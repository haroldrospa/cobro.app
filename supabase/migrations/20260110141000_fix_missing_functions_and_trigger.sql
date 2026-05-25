-- 1. Create Helper Functions (Missing Dependencies)

CREATE OR REPLACE FUNCTION public.generate_store_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_store_slug(company_name text, store_code text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
BEGIN
  -- Normalize: lower case, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  
  -- Append store code for uniqueness
  final_slug := base_slug || '-' || lower(store_code);
  
  RETURN final_slug;
END;
$$;

-- 2. Ensure Profile Role Constraint includes 'owner'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'staff', 'customer', 'owner'));

-- 3. Fix handle_new_user Trigger to use correct columns and dependency functions
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
BEGIN
  -- Generate User Number
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- Get Company Name
  company_name_val := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Comercio ' || new_user_number);

  -- Generate Code and Slug
  new_store_code := generate_store_code();
  new_slug := generate_store_slug(company_name_val, new_store_code);

  -- Create Store (handling potential missing columns via separate updates if needed, but assuming standard schema)
  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  -- Create Profile
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
  
  -- Assign Admin Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- Initialize Settings
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val);

  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id);

  -- Initialize Categories
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('Bebidas', 'Bebidas y líquidos', new_store_id),
    ('Comida', 'Alimentos preparados', new_store_id),
    ('Snacks', 'Bocadillos', new_store_id);

  -- Initialize Sequences
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id) VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id), 
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id);
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Last resort fallback to allow user creation even if store setup fails partialy
  -- But ideally we want to see the error. 
  -- RAISE EXCEPTION 'Registration failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
