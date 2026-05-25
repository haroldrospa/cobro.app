-- =====================================================
-- TABLA DE OFERTAS POR CANTIDAD
-- Ejemplo: 2 pinchos por $150 (en lugar de $200)
-- =====================================================

CREATE TABLE IF NOT EXISTS product_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Configuración de la oferta
  quantity INTEGER NOT NULL CHECK (quantity > 1), -- Cantidad mínima (ej: 2, 3, 5)
  offer_price DECIMAL(10, 2) NOT NULL CHECK (offer_price > 0), -- Precio total por esa cantidad
  
  -- Metadatos
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Restricciones
  UNIQUE(product_id, quantity)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_product_offers_product_id ON product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_store_id ON product_offers(store_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_active ON product_offers(is_active) WHERE is_active = true;

-- RLS (Row Level Security)
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;

-- Política: Ver ofertas de tu tienda
CREATE POLICY "Users can view offers from their store"
ON product_offers FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política: Crear ofertas en tu tienda
CREATE POLICY "Users can create offers in their store"
ON product_offers FOR INSERT
TO authenticated
WITH CHECK (
  store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política: Actualizar ofertas de tu tienda
CREATE POLICY "Users can update offers in their store"
ON product_offers FOR UPDATE
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política: Eliminar ofertas de tu tienda
CREATE POLICY "Users can delete offers in their store"
ON product_offers FOR DELETE
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_product_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_offers_updated_at
BEFORE UPDATE ON product_offers
FOR EACH ROW
EXECUTE FUNCTION update_product_offers_updated_at();

-- Comentarios
COMMENT ON TABLE product_offers IS 'Ofertas por cantidad para productos (ej: 2x150, 3x200)';
COMMENT ON COLUMN product_offers.quantity IS 'Cantidad mínima para aplicar la oferta';
COMMENT ON COLUMN product_offers.offer_price IS 'Precio total al comprar la cantidad especificada';
