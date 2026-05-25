-- =====================================================
-- ACTUALIZACIÓN: AGREGAR FECHAS DE EXPIRACIÓN A OFERTAS
-- Ejecuta este script si ya creaste la tabla basic product_offers
-- =====================================================

ALTER TABLE product_offers
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

COMMENT ON COLUMN product_offers.valid_from IS 'Fecha de inicio de la oferta';
COMMENT ON COLUMN product_offers.valid_to IS 'Fecha de expiración (NULL = indefinida)';

-- Actualizar vista o lógica si es necesario
-- Por defecto valid_from es NOW() para que sean válidas inmediatamente
-- valid_to NULL significa "para siempre"
