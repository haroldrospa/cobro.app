-- =====================================================
-- VENCIMIENTO DE PUNTOS DE LEALTAD - 45 DÍAS
-- Versión corregida para la estructura existente
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna expires_at a loyalty_transactions
ALTER TABLE public.loyalty_transactions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Agregar columna en customers para mostrar próxima fecha de vencimiento
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS loyalty_points_expires_at TIMESTAMPTZ;

-- 3. Marcar transacciones de puntos GANADOS existentes con expires_at
UPDATE public.loyalty_transactions
SET expires_at = created_at + INTERVAL '45 days'
WHERE points_earned > 0
  AND expires_at IS NULL;

-- 4. Actualizar la fecha de vencimiento más próxima para cada cliente
UPDATE public.customers c
SET loyalty_points_expires_at = (
    SELECT MIN(expires_at)
    FROM public.loyalty_transactions lt
    WHERE lt.customer_id = c.id
      AND lt.points_earned > 0
      AND lt.expires_at > NOW()
)
WHERE loyalty_points > 0;

-- 5. Función para vencer puntos caducados de un cliente
CREATE OR REPLACE FUNCTION expire_loyalty_points(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_points INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(lt.points_earned), 0)
    INTO expired_points
    FROM public.loyalty_transactions lt
    WHERE lt.customer_id = p_customer_id
      AND lt.points_earned > 0
      AND lt.expires_at IS NOT NULL
      AND lt.expires_at < NOW()
      AND (lt.notes IS NULL OR lt.notes NOT LIKE '%[VENCIDO]%');

    IF expired_points > 0 THEN
        INSERT INTO public.loyalty_transactions (
            customer_id, points_redeemed, points_balance_after, notes
        )
        SELECT
            p_customer_id,
            expired_points,
            GREATEST(0, COALESCE(c.loyalty_points, 0) - expired_points),
            'Puntos vencidos automáticamente (45 días)'
        FROM public.customers c
        WHERE c.id = p_customer_id;

        UPDATE public.loyalty_transactions
        SET notes = COALESCE(notes || ' ', '') || '[VENCIDO]'
        WHERE customer_id = p_customer_id
          AND points_earned > 0
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
          AND (notes IS NULL OR notes NOT LIKE '%[VENCIDO]%');

        UPDATE public.customers
        SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - expired_points)
        WHERE id = p_customer_id;
    END IF;

    UPDATE public.customers
    SET loyalty_points_expires_at = (
        SELECT MIN(lt.expires_at)
        FROM public.loyalty_transactions lt
        WHERE lt.customer_id = p_customer_id
          AND lt.points_earned > 0
          AND lt.expires_at > NOW()
          AND (lt.notes IS NULL OR lt.notes NOT LIKE '%[VENCIDO]%')
    )
    WHERE id = p_customer_id;

    RETURN expired_points;
END;
$$;

-- 6. Actualizar award_loyalty_points con expires_at = +45 días
CREATE OR REPLACE FUNCTION award_loyalty_points(
    p_customer_id UUID,
    p_sale_total NUMERIC,
    p_sale_id UUID DEFAULT NULL,
    p_store_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_points_earned INTEGER;
    v_new_balance INTEGER;
    expiry_date TIMESTAMPTZ;
BEGIN
    PERFORM expire_loyalty_points(p_customer_id);
    v_points_earned := FLOOR(p_sale_total / 100);
    IF v_points_earned <= 0 THEN RETURN 0; END IF;
    expiry_date := NOW() + INTERVAL '45 days';

    UPDATE public.customers
    SET
        loyalty_points = COALESCE(loyalty_points, 0) + v_points_earned,
        loyalty_points_expires_at = CASE
            WHEN loyalty_points_expires_at IS NULL OR loyalty_points_expires_at < NOW()
                THEN expiry_date
            ELSE LEAST(loyalty_points_expires_at, expiry_date)
        END
    WHERE id = p_customer_id
    RETURNING loyalty_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions (
        customer_id, store_id, sale_id, points_earned, points_balance_after, sale_total, notes, expires_at
    ) VALUES (
        p_customer_id, p_store_id, p_sale_id, v_points_earned, v_new_balance,
        p_sale_total, 'Puntos ganados por compra', expiry_date
    );

    RETURN v_points_earned;
END;
$$;

-- 7. Actualizar redeem_loyalty_points (vencer antes de canjear)
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
    p_customer_id UUID,
    p_points_to_redeem INTEGER,
    p_store_id UUID DEFAULT NULL,
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
    PERFORM expire_loyalty_points(p_customer_id);

    SELECT COALESCE(loyalty_points, 0) INTO v_current_points
    FROM public.customers WHERE id = p_customer_id;

    IF v_current_points < p_points_to_redeem THEN
        RAISE EXCEPTION 'Puntos insuficientes. Disponibles: %', v_current_points;
    END IF;

    v_discount_amount := p_points_to_redeem::DECIMAL;

    UPDATE public.customers
    SET loyalty_points = loyalty_points - p_points_to_redeem
    WHERE id = p_customer_id
    RETURNING loyalty_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions (
        customer_id, store_id, sale_id, points_redeemed, points_balance_after, notes
    ) VALUES (
        p_customer_id, p_store_id, p_sale_id, p_points_to_redeem, v_new_balance,
        'Puntos canjeados como descuento'
    );

    RETURN v_discount_amount;
END;
$$;

-- 8. Actualizar find_customer_by_rnc (nueva columna en retorno)
DROP FUNCTION IF EXISTS find_customer_by_rnc(text, uuid);
DROP FUNCTION IF EXISTS find_customer_by_rnc(text);
CREATE OR REPLACE FUNCTION find_customer_by_rnc(p_rnc TEXT, p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    rnc TEXT,
    phone TEXT,
    email TEXT,
    loyalty_points INTEGER,
    loyalty_points_expires_at TIMESTAMPTZ,
    credit_limit DECIMAL,
    credit_used DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.rnc = p_rnc
      AND (p_store_id IS NULL OR c.store_id = p_store_id OR c.store_id IS NULL)
    LIMIT 1;

    IF v_customer_id IS NULL THEN RETURN; END IF;

    PERFORM expire_loyalty_points(v_customer_id);

    RETURN QUERY
    SELECT
        c.id, c.name::TEXT, c.rnc::TEXT, c.phone::TEXT, c.email::TEXT,
        COALESCE(c.loyalty_points, 0),
        c.loyalty_points_expires_at,
        COALESCE(c.credit_limit, 0),
        COALESCE(c.credit_used, 0)
    FROM public.customers c
    WHERE c.id = v_customer_id;
END;
$$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT
    c.name,
    c.loyalty_points,
    c.loyalty_points_expires_at,
    COUNT(lt.id) as transacciones
FROM public.customers c
LEFT JOIN public.loyalty_transactions lt ON lt.customer_id = c.id
GROUP BY c.id, c.name, c.loyalty_points, c.loyalty_points_expires_at
ORDER BY c.loyalty_points DESC
LIMIT 20;