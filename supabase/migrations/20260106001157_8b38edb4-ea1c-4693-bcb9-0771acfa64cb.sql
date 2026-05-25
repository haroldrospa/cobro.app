-- Drop the incorrect policy
DROP POLICY IF EXISTS "Store owners can manage their banners" ON public.promotional_banners;

-- Create correct INSERT policy
CREATE POLICY "Store owners can insert banners"
ON public.promotional_banners
FOR INSERT
TO authenticated
WITH CHECK (owns_store(auth.uid(), store_id));

-- Create correct UPDATE policy
CREATE POLICY "Store owners can update banners"
ON public.promotional_banners
FOR UPDATE
TO authenticated
USING (owns_store(auth.uid(), store_id))
WITH CHECK (owns_store(auth.uid(), store_id));

-- Create correct DELETE policy
CREATE POLICY "Store owners can delete banners"
ON public.promotional_banners
FOR DELETE
TO authenticated
USING (owns_store(auth.uid(), store_id));

-- Create correct SELECT policy for owners (to see inactive too)
CREATE POLICY "Store owners can view all their banners"
ON public.promotional_banners
FOR SELECT
TO authenticated
USING (owns_store(auth.uid(), store_id));