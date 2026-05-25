-- 1. Update the role constraint to include 'owner'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'staff', 'customer', 'owner'));

-- 2. Comprehensive fix for handle_new_user trigger
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
  -- 1. Generate User Number (USR-XXXXXX)
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- 2. Extract Company Name from meta data
  company_name_val := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Mi Comercio ' || new_user_number);

  -- 3. Generate Store Code and Slug using existing helper functions
  new_store_code := generate_store_code();
  new_slug := generate_store_slug(company_name_val, new_store_code);

  -- 4. Create Store with correct column names
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
  
  -- 6. Assign Role in user_roles table
  -- Note: We use 'admin' for the owner to ensure they have full DB permissions via app_role enum
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- 7. Initialize Company Settings
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val);

  -- 8. Initialize Store Settings
  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id);

  -- 9. Initialize Default Categories
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('Bebidas', 'Bebidas y líquidos', new_store_id),
    ('Comida', 'Alimentos preparados', new_store_id),
    ('Snacks', 'Bocadillos', new_store_id);

  -- 10. Initialize Default Invoice Sequences
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id) VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id), 
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id);
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error details if needed (optional, for debugging)
  -- RAISE LOG 'Error in handle_new_user for %: %', NEW.email, SQLERRM;
  RETURN NEW; -- Still return NEW to allow registration if possible, though it might lack data
END;
$$;
