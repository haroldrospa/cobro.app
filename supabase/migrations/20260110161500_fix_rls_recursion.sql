-- 1. Create a Secure Helper Function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_id UUID;
BEGIN
    -- This runs with admin privileges, bypassing RLS on profiles to safely get the store_id
    SELECT store_id INTO found_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN found_id;
END;
$$;

-- 2. Update STORES Policy
DROP POLICY IF EXISTS "Owners can view and update their own store" ON public.stores;
CREATE POLICY "Owners can view and update their own store" 
ON public.stores
FOR ALL 
USING (
    owner_id = auth.uid() OR
    id = public.get_auth_store_id()
);

-- 3. Update PROFILES Policy
DROP POLICY IF EXISTS "Users can see profiles from their same store" ON public.profiles;
CREATE POLICY "Users can see profiles from their same store" 
ON public.profiles
FOR ALL 
USING (
    id = auth.uid() OR
    store_id = public.get_auth_store_id()
);

-- 4. Update STORE SETTINGS Policy
DROP POLICY IF EXISTS "Users can only view/edit settings for their store" ON public.store_settings;
CREATE POLICY "Users can only view/edit settings for their store" 
ON public.store_settings
FOR ALL 
USING (
    store_id = public.get_auth_store_id()
);

-- 5. Update COMPANY SETTINGS Policy
DROP POLICY IF EXISTS "Users can only view/edit company settings for their store" ON public.company_settings;
CREATE POLICY "Users can only view/edit company settings for their store" 
ON public.company_settings
FOR ALL 
USING (
    store_id = public.get_auth_store_id()
);

-- 6. Grant execute permission just in case
GRANT EXECUTE ON FUNCTION public.get_auth_store_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_store_id TO service_role;
