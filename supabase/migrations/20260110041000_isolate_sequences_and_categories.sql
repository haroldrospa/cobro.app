-- 1. Create a Helper Function to fix orphaned data
-- This is useful if you already have data in the db
CREATE OR REPLACE FUNCTION public.fix_sequences_isolation()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- Add store_id to invoice_sequences if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_sequences' AND column_name = 'store_id') THEN
        ALTER TABLE public.invoice_sequences ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;

    -- Drop the unique constraint on invoice_type_id because it's now unique PER STORE
    ALTER TABLE public.invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;
    
    -- Function to get the next number must be updated to use store_id
    -- See Step 3 below
END $$;
SELECT public.fix_sequences_isolation();


-- 2. Update RLS policies for Invoice Sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to invoice sequences" ON public.invoice_sequences; 
DROP POLICY IF EXISTS "Users can view own store sequences" ON public.invoice_sequences;

CREATE POLICY "Users can view own store sequences" ON public.invoice_sequences
FOR ALL USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);


-- 3. Update the Function to get Next Invoice Number to be Store-Aware
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(invoice_type_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  formatted_number text;
  user_store_id uuid;
BEGIN
  -- Get current user's store
  SELECT store_id INTO user_store_id FROM public.profiles WHERE id = auth.uid();

  -- Get and increment the current number FOR THIS STORE
  UPDATE public.invoice_sequences 
  SET current_number = current_number + 1,
      updated_at = now()
  WHERE invoice_type_id = invoice_type_code 
  AND store_id = user_store_id
  RETURNING current_number INTO next_number;
  
  -- If no sequence exists for this store yet, insert it starting at 1
  IF next_number IS NULL THEN
      INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
      VALUES (invoice_type_code, 1, user_store_id)
      RETURNING current_number INTO next_number;
  END IF;
  
  -- Format as type + zero-padded number (e.g., B01-001)
  formatted_number := invoice_type_code || '-' || LPAD(next_number::text, 8, '0');
  
  RETURN formatted_number;
END;
$$;


-- 4. Update Trigger to Initialize Default Sequences AND Categories for New Stores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id UUID;
  new_user_number TEXT;
  counter INTEGER;
BEGIN
  -- Generate User Number
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- Create Store
  INSERT INTO public.stores (name, owner_id)
  VALUES ('Comercio ' || new_user_number, NEW.id)
  RETURNING id INTO new_store_id;

  -- Create Profile
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    new_user_number,
    new_store_id,
    'owner'
  );
  
  -- Assign Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  -- --- INITIALIZE DEFAULT DATA FOR NEW STORE ---

  -- 1. Default Categories
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('Bebidas', 'Bebidas y líquidos', new_store_id),
    ('Comida', 'Alimentos preparados', new_store_id),
    ('Snacks', 'Bocadillos', new_store_id);

  -- 2. Default Invoice Sequences
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id) VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id), 
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id);
    
  RETURN NEW;
END;
$$;
