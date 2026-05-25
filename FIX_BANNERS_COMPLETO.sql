-- ============================================================
-- EJECUTAR ESTO EN SUPABASE > SQL EDITOR
-- Asegúrate de estar conectado con el rol "postgres" (no anon)
-- ============================================================

-- PASO 1: Hacer el bucket PÚBLICO (esto es lo crítico)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'product-images';

-- Si no existe, créalo:
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- PASO 2: Limpiar y recrear políticas de storage
DROP POLICY IF EXISTS "Public Access to Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on product-images" ON storage.objects;
DROP POLICY IF EXISTS "give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to product-images" ON storage.objects;

-- Lectura pública irrestricta (lo más importante)
CREATE POLICY "Allow public read on product-images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Escritura para autenticados
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'product-images' );

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'product-images' )
WITH CHECK ( bucket_id = 'product-images' );

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'product-images' );

-- PASO 3: Arreglar tabla promotional_banners
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Public can view active banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Store owners can view all their banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Store owners can insert banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Store owners can update banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Store owners can delete banners" ON public.promotional_banners;
DROP POLICY IF EXISTS "Store owners can manage their banners" ON public.promotional_banners;

-- Cualquiera puede ver banners activos
CREATE POLICY "Public can view active banners"
ON public.promotional_banners FOR SELECT
USING (is_active = true);

-- Dueños de tienda pueden ver sus propios banners
CREATE POLICY "Store owners can view all their banners"
ON public.promotional_banners FOR SELECT
TO authenticated
USING (owns_store(auth.uid(), store_id));

-- Dueños pueden insertar
CREATE POLICY "Store owners can insert banners"
ON public.promotional_banners FOR INSERT
TO authenticated
WITH CHECK (owns_store(auth.uid(), store_id));

-- Dueños pueden actualizar
CREATE POLICY "Store owners can update banners"
ON public.promotional_banners FOR UPDATE
TO authenticated
USING (owns_store(auth.uid(), store_id))
WITH CHECK (owns_store(auth.uid(), store_id));

-- Dueños pueden borrar
CREATE POLICY "Store owners can delete banners"
ON public.promotional_banners FOR DELETE
TO authenticated
USING (owns_store(auth.uid(), store_id));

-- ============================================================
-- VERIFICACIÓN - Resultado esperado: public = true
-- ============================================================
SELECT 
  id, 
  name, 
  public,
  CASE 
    WHEN public = true THEN '✅ PÚBLICO - Las imágenes serán visibles'
    ELSE '❌ PRIVADO - Las imágenes NO serán visibles'
  END as resultado
FROM storage.buckets 
WHERE id = 'product-images';
