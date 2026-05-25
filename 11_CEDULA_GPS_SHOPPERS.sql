-- =========================================================
-- 11_CEDULA_GPS_SHOPPERS.sql
-- Agrega cédula y coordenadas GPS a perfiles de clientes web
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Agrega campo cedula al perfil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cedula TEXT;

-- 2. Agrega campos de coordenadas GPS para la ubicación de entrega
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION;

-- 3. Agrega etiqueta de la ubicación (ej: "Mi Casa", "Trabajo")
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_location_label TEXT;

-- 4. Agrega dirección textual de entrega al perfil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- 5. Agrega notas de entrega al perfil
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- 6. Índice para cédula (búsqueda rápida por documento)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cedula_unique
  ON profiles (cedula)
  WHERE cedula IS NOT NULL AND cedula <> '';

-- Verificar columnas agregadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('cedula', 'delivery_lat', 'delivery_lng', 'delivery_location_label', 'delivery_address', 'delivery_notes');
