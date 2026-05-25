-- Drop potentially problematic policies
DROP POLICY IF EXISTS "Ver perfiles del mismo comercio" ON public.profiles;
DROP POLICY IF EXISTS "Admins gestionan perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "View teammates" ON public.profiles;

-- 1. Users can always view their own profile (Foundation)
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. Store Owners can view ALL profiles in their store
-- This avoids recursion by querying the `stores` table, not `profiles`
CREATE POLICY "Store owners can view store members" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
  )
);

-- 3. Store Owners can update profiles in their store
CREATE POLICY "Store owners can update store members" 
ON public.profiles FOR UPDATE
TO authenticated 
USING (
  store_id IN (
    SELECT id FROM public.stores WHERE owner_id = auth.uid()
  )
);

-- 4. Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
