-- ============================================================
-- FIX COMPLETO: Storage product-images acceso público
-- Ejecuta TODO esto en Supabase SQL Editor
-- ============================================================

-- 1. Asegurar que el bucket sea público y sin restricciones
UPDATE storage.buckets
SET 
  public = true,
  allowed_mime_types = NULL,
  file_size_limit = 5242880
WHERE id = 'product-images';

-- Si el bucket no existe aún, crearlo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Eliminar políticas anteriores que puedan estar en conflicto
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

-- 3. Política: CUALQUIERA puede VER/DESCARGAR imágenes de productos (sin autenticación)
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- 4. Política: Usuarios autenticados pueden SUBIR imágenes
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- 5. Política: Usuarios autenticados pueden ACTUALIZAR imágenes
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- 6. Política: Usuarios autenticados pueden ELIMINAR imágenes
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Verificar resultado final
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'product-images';
