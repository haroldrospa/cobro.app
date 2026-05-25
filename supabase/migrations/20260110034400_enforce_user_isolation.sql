-- 1. Ensure Stores table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own store" ON public.stores
    FOR SELECT USING (owner_id = auth.uid());

-- 2. Ensure all data tables have store_id
DO $$ 
BEGIN
    -- Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'store_id') THEN
        ALTER TABLE public.customers ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;

    -- Sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'store_id') THEN
        ALTER TABLE public.sales ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;

    -- Categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'store_id') THEN
        ALTER TABLE public.categories ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;

      -- Products (likely exists but safeguard)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'store_id') THEN
        ALTER TABLE public.products ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;
END $$;

-- 3. Modify handle_new_user to Create Store and Assign it
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
  -- Generate User Number (USR-00000X)
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- Create a new unique Store for this user
  INSERT INTO public.stores (name, owner_id)
  VALUES ('Comercio ' || new_user_number, NEW.id)
  RETURNING id INTO new_store_id;

  -- Create Profile linked to the new store
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    new_user_number,
    new_store_id,
    'owner'
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;


-- 4. Update RLS Policies to be STRICT (Isolation)

-- Helper function to get current user's store_id efficiently
-- (Optional, but using direct subquery is fine for now)

-- PRODUCTS
DROP POLICY IF EXISTS "Allow public access" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Users can view own store products" ON public.products;

CREATE POLICY "Users can view own store products" ON public.products
FOR ALL USING (
    store_id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- CUSTOMERS
DROP POLICY IF EXISTS "Allow public access" ON public.customers;
DROP POLICY IF EXISTS "Users can view own store customers" ON public.customers;

CREATE POLICY "Users can view own store customers" ON public.customers
FOR ALL USING (
    store_id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- SALES
DROP POLICY IF EXISTS "Allow public access" ON public.sales;
DROP POLICY IF EXISTS "Users can view own store sales" ON public.sales;

CREATE POLICY "Users can view own store sales" ON public.sales
FOR ALL USING (
    store_id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- CATEGORIES
DROP POLICY IF EXISTS "Allow public access" ON public.categories;
DROP POLICY IF EXISTS "Users can view own store categories" ON public.categories;

CREATE POLICY "Users can view own store categories" ON public.categories
FOR ALL USING (
    store_id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- MIGRATION FIX: Assign existing orphan data to a default store if needed?
-- For now, we leave NULLs invisible to new users (which serves the goal).
-- Existing users might lose visibility until we assign their data. 
-- We assume this is a dev/new production setup where isolation is priority.
