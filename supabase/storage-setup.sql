-- =====================================================
-- CONFIGURACIÓN DE STORAGE PARA IMÁGENES DE PRODUCTOS
-- Ejecuta este script en Supabase SQL Editor
-- =====================================================

-- 1. Crear el bucket si no existe (public = true para acceso público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar políticas antiguas si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Public Access to Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- 3. Crear política para lectura pública (CRÍTICO - permite ver las imágenes)
CREATE POLICY "Public Access to Product Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- 4. Crear política para subir imágenes (solo usuarios autenticados)
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'product-images' );

-- 5. Crear política para actualizar imágenes (solo usuarios autenticados)
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'product-images' )
WITH CHECK ( bucket_id = 'product-images' );

-- 6. Crear política para eliminar imágenes (solo usuarios autenticados)
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'product-images' );

-- =====================================================
-- VERIFICACIÓN (esto debe mostrar el bucket configurado)
-- =====================================================
SELECT 
  id, 
  name, 
  public,
  CASE 
    WHEN public = true THEN '✅ Público (correcto)'
    ELSE '❌ Privado (incorrecto!)'
  END as status
FROM storage.buckets 
WHERE id = 'product-images';
