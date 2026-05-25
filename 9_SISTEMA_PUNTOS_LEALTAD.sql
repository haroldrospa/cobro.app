-- =============================================
-- SISTEMA DE PUNTOS DE LEALTAD PARA COBRO.APP
-- Ejecuta este archivo completo en Supabase SQL Editor
-- =============================================

-- 1. Agregar columna de puntos a la tabla de clientes
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;

-- 2. Tabla de historial de puntos (opcional pero útil para auditoría)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  points_balance_after INTEGER DEFAULT 0,
  sale_total DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Política RLS
DROP POLICY IF EXISTS "Store staff can manage loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Store staff can manage loyalty transactions" ON public.loyalty_transactions
  FOR ALL USING (true);

-- 5. Función RPC para sumar puntos a un cliente tras una venta
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_customer_id UUID,
  p_sale_total DECIMAL,
  p_sale_id UUID,
  p_store_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points_earned INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 1 punto por cada $100 pesos
  v_points_earned := FLOOR(p_sale_total / 100);
  
  IF v_points_earned <= 0 THEN
    RETURN 0;
  END IF;

  -- Actualizar balance de puntos del cliente
  UPDATE public.customers
  SET loyalty_points = COALESCE(loyalty_points, 0) + v_points_earned
  WHERE id = p_customer_id
  RETURNING loyalty_points INTO v_new_balance;

  -- Registrar transacción
  INSERT INTO public.loyalty_transactions (
    customer_id, store_id, sale_id, points_earned, points_balance_after, sale_total, notes
  ) VALUES (
    p_customer_id, p_store_id, p_sale_id, v_points_earned, v_new_balance,
    p_sale_total, 'Puntos ganados por compra'
  );

  RETURN v_points_earned;
END;
$$;

-- 6. Función RPC para canjear puntos de un cliente
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_customer_id UUID,
  p_points_to_redeem INTEGER,
  p_store_id UUID,
  p_sale_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_discount_amount DECIMAL;
  v_new_balance INTEGER;
BEGIN
  -- Obtener puntos actuales
  SELECT COALESCE(loyalty_points, 0) INTO v_current_points
  FROM public.customers
  WHERE id = p_customer_id;

  -- Validar que tiene suficientes puntos
  IF v_current_points < p_points_to_redeem THEN
    RAISE EXCEPTION 'Puntos insuficientes. Disponibles: %', v_current_points;
  END IF;

  -- Cada punto = $1 peso de descuento
  v_discount_amount := p_points_to_redeem::DECIMAL;

  -- Descontar puntos
  UPDATE public.customers
  SET loyalty_points = loyalty_points - p_points_to_redeem
  WHERE id = p_customer_id
  RETURNING loyalty_points INTO v_new_balance;

  -- Registrar transacción
  INSERT INTO public.loyalty_transactions (
    customer_id, store_id, sale_id, points_redeemed, points_balance_after, notes
  ) VALUES (
    p_customer_id, p_store_id, p_sale_id, p_points_to_redeem, v_new_balance,
    'Puntos canjeados como descuento'
  );

  RETURN v_discount_amount;
END;
$$;

-- 7. Función para buscar cliente por cédula (RNC)
CREATE OR REPLACE FUNCTION find_customer_by_rnc(p_rnc TEXT, p_store_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rnc TEXT,
  phone TEXT,
  email TEXT,
  loyalty_points INTEGER,
  credit_limit DECIMAL,
  credit_used DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.name::TEXT, c.rnc::TEXT, c.phone::TEXT, c.email::TEXT,
    COALESCE(c.loyalty_points, 0) as loyalty_points,
    COALESCE(c.credit_limit, 0) as credit_limit,
    COALESCE(c.credit_used, 0) as credit_used
  FROM public.customers c
  WHERE c.rnc = p_rnc
    AND (c.store_id = p_store_id OR c.store_id IS NULL)
  LIMIT 1;
END;
$$;
