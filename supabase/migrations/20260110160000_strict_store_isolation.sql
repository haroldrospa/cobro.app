-- 1. Strictly isolate store visibility
DROP POLICY IF EXISTS "Users can view their own store" ON public.stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stores;
DROP POLICY IF EXISTS "Stores are viewable by everyone" ON public.stores;

CREATE POLICY "Owners can view and update their own store" 
ON public.stores
FOR ALL 
USING (
    owner_id = auth.uid() OR
    id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. Ensure Store Settings are also strictly isolated
DROP POLICY IF EXISTS "Store settings are viewable by everyone" ON public.store_settings;
DROP POLICY IF EXISTS "Store owners can view their settings" ON public.store_settings;

CREATE POLICY "Users can only view/edit settings for their store" 
ON public.store_settings
FOR ALL 
USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- 3. Fix potential confusion in Company Settings
DROP POLICY IF EXISTS "Company settings are viewable by everyone" ON public.company_settings;
CREATE POLICY "Users can only view/edit company settings for their store" 
ON public.company_settings
FOR ALL 
USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
);

-- 4. Fix Profile Isolation (users shouldn't see other users unless in same store)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can see profiles from their same store" 
ON public.profiles
FOR ALL 
USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR
    id = auth.uid()
);

-- 5. Helper to double check the user's store_id is set correctly on registration
-- (This is a safeguard update trigger we can add)

CREATE OR REPLACE FUNCTION public.sync_profile_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If store_id is null on profile update, try to find owned store
  IF NEW.store_id IS NULL THEN
     SELECT id INTO NEW.store_id FROM public.stores WHERE owner_id = NEW.id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
