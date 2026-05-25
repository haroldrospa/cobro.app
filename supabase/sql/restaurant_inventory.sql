-- ============================================================
-- RESTAURANT INVENTORY CONTROL
-- Ejecutar este script en Supabase → SQL Editor
-- ============================================================

-- 1. Tabla de ingredientes del restaurante
CREATE TABLE IF NOT EXISTS restaurant_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidad',  -- unidad, lb, kg, lt, ml, taza, etc.
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'General',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de recetas: qué ingredientes consume cada producto del menú
CREATE TABLE IF NOT EXISTS product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,  -- cuánto consume por unidad vendida
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

-- 3. RLS (Row Level Security)
ALTER TABLE restaurant_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso para restaurant_ingredients
CREATE POLICY "Users can manage their store ingredients"
  ON restaurant_ingredients
  FOR ALL
  USING (
    store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5. Políticas de acceso para product_recipes
CREATE POLICY "Users can manage their product recipes"
  ON product_recipes
  FOR ALL
  USING (
    ingredient_id IN (
      SELECT id FROM restaurant_ingredients
      WHERE store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    ingredient_id IN (
      SELECT id FROM restaurant_ingredients
      WHERE store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 6. Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_restaurant_ingredients_store_id
  ON restaurant_ingredients(store_id);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id
  ON product_recipes(product_id);

CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient_id
  ON product_recipes(ingredient_id);

-- 7. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_restaurant_ingredients_updated_at ON restaurant_ingredients;
CREATE TRIGGER update_restaurant_ingredients_updated_at
  BEFORE UPDATE ON restaurant_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Función para descontar stock de un ingrediente de forma segura (sin bajar de 0)
CREATE OR REPLACE FUNCTION decrement_ingredient_stock(
  p_ingredient_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE restaurant_ingredients
  SET
    stock = GREATEST(0, stock - p_amount),
    updated_at = NOW()
  WHERE id = p_ingredient_id;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION decrement_ingredient_stock(UUID, NUMERIC) TO authenticated;

