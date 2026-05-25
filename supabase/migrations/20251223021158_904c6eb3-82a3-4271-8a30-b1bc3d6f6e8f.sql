-- Allow store owners to manage their own company_settings
CREATE POLICY "Store owners can insert their company settings"
ON public.company_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = company_settings.store_id
    AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners can update their company settings"
ON public.company_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = company_settings.store_id
    AND stores.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = company_settings.store_id
    AND stores.owner_id = auth.uid()
  )
);