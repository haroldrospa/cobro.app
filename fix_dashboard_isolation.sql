-- =========================================================
-- OPTIMIZACIÓN DEL DASHBOARD (V2 FINAL - ISOLATED)
-- Funciones para calcular estadísticas en el servidor
-- CORREGIDO: Aislamiento por tienda usando store_id
-- =========================================================

-- 1. Obtener métricas generales del dashboard (Tarjetas principales)
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date timestamptz,
    p_end_date timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_total_sales numeric;
    v_total_count integer;
    v_avg_ticket numeric;
    v_today_sales numeric;
    v_today_count integer;
    v_yesterday_sales numeric;
    v_active_products integer;
    v_low_stock integer;
    v_overdue_count integer;
    v_today_start timestamptz;
    v_yesterday_start timestamptz;
    v_yesterday_end timestamptz;
BEGIN
    -- Obtener store_id del usuario actual
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    -- Definir fechas clave
    v_today_start := date_trunc('day', now());
    v_yesterday_start := date_trunc('day', now() - interval '1 day');
    v_yesterday_end := v_today_start - interval '1 second';
    
    -- 1. Ventas Totales en el rango seleccionado
    SELECT 
        COALESCE(SUM(total), 0), 
        COUNT(*) 
    INTO 
        v_total_sales, 
        v_total_count 
    FROM sales 
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND store_id = v_store_id;

    -- Ticket promedio
    IF v_total_count > 0 THEN
        v_avg_ticket := v_total_sales / v_total_count;
    ELSE
        v_avg_ticket := 0;
    END IF;

    -- 2. Ventas de Hoy (Siempre calcula sobre el día actual real, independiente del filtro)
    SELECT 
        COALESCE(SUM(total), 0), 
        COUNT(*) 
    INTO 
        v_today_sales, 
        v_today_count 
    FROM sales 
    WHERE created_at >= v_today_start
      AND store_id = v_store_id;

    -- 3. Ventas de Ayer (Para comparación)
    SELECT 
        COALESCE(SUM(total), 0)
    INTO 
        v_yesterday_sales
    FROM sales 
    WHERE created_at BETWEEN v_yesterday_start AND v_yesterday_end
      AND store_id = v_store_id;

    -- 4. Métricas de Inventario
    SELECT COUNT(*) INTO v_active_products FROM products WHERE status = 'active' AND store_id = v_store_id;
    SELECT COUNT(*) INTO v_low_stock FROM products WHERE status = 'active' AND stock <= min_stock AND store_id = v_store_id;

    -- 5. Cuentas por cobrar vencidas
    SELECT COUNT(DISTINCT customer_id) INTO v_overdue_count 
    FROM sales 
    WHERE payment_status = 'pending' 
      AND due_date < now() 
      AND customer_id IS NOT NULL
      AND store_id = v_store_id;

    -- Retornar todo en un JSON
    RETURN json_build_object(
        'total_sales', v_total_sales,
        'total_count', v_total_count,
        'avg_ticket', v_avg_ticket,
        'today_sales', v_today_sales,
        'today_count', v_today_count,
        'yesterday_sales', v_yesterday_sales,
        'active_products', v_active_products,
        'low_stock', v_low_stock,
        'overdue_count', v_overdue_count
    );
END;
$$;

-- 2. Obtener Ventas Mensuales
CREATE OR REPLACE FUNCTION get_monthly_sales_stats(p_year integer)
RETURNS TABLE (
    month_index integer,
    total_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        EXTRACT(MONTH FROM created_at)::integer - 1 as month_index,
        SUM(total) as total_sales
    FROM sales
    WHERE EXTRACT(YEAR FROM created_at) = p_year
      AND store_id = v_store_id
    GROUP BY month_index
    ORDER BY month_index;
END;
$$;

-- 3. Obtener Ventas por Categoría
CREATE OR REPLACE FUNCTION get_sales_by_category_stats(
    p_start_date timestamptz,
    p_end_date timestamptz
)
RETURNS TABLE (
    category_name text,
    total_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        c.name as category_name,
        SUM(si.total) as total_sales
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date
      AND s.store_id = v_store_id
      -- Nota: No necesitamos filtrar products por store_id si ya filtramos sales, 
      -- pero por seguridad p.store_id también debería coincidir.
      -- Sin embargo, confiamos en la relación sales->store_id.
    GROUP BY c.name
    ORDER BY total_sales DESC
    LIMIT 10;
END;
$$;

-- 4. Obtener Top Productos
CREATE OR REPLACE FUNCTION get_top_products_stats(
    p_start_date timestamptz,
    p_end_date timestamptz,
    p_limit integer
)
RETURNS TABLE (
    product_name text,
    quantity_sold numeric,
    total_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        p.name as product_name,
        SUM(si.quantity)::numeric as quantity_sold,
        SUM(si.total) as total_sales
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date
      AND s.store_id = v_store_id
    GROUP BY p.id, p.name
    ORDER BY total_sales DESC
    LIMIT p_limit;
END;
$$;

-- 5. Obtener Ventas por Hora
CREATE OR REPLACE FUNCTION get_hourly_sales_stats(
    p_start_date timestamptz,
    p_end_date timestamptz
)
RETURNS TABLE (
    hour integer,
    total_sales numeric,
    usage_count bigint 
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM created_at)::integer as hour,
        SUM(total) as total_sales,
        COUNT(*) as usage_count
    FROM sales
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND store_id = v_store_id
    GROUP BY hour
    ORDER BY hour;
END;
$$;

-- 6. Obtener Productos con Stock Bajo (Solo lista limitada)
CREATE OR REPLACE FUNCTION get_low_stock_products_list()
RETURNS TABLE (
    id uuid,
    name text,
    stock numeric,
    min_stock numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT p.id, p.name, p.stock, p.min_stock
    FROM products p
    WHERE p.status = 'active'
      AND p.stock <= p.min_stock
      AND p.store_id = v_store_id
    LIMIT 50; 
END;
$$;

-- 7. Clientes con crédito alto (Optimization)
CREATE OR REPLACE FUNCTION get_high_credit_customers_list()
RETURNS TABLE (
    id uuid,
    name text,
    credit_limit numeric,
    credit_used numeric,
    usage_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        c.id, 
        c.name, 
        c.credit_limit, 
        c.credit_used,
        ROUND((c.credit_used / c.credit_limit) * 100) as usage_percentage
    FROM customers c
    WHERE c.credit_limit > 0 
      AND (c.credit_used / c.credit_limit) >= 0.8
      AND c.store_id = v_store_id;
END;
$$;

-- 8. Obtener Top Clientes (OPTIMIZADO)
CREATE OR REPLACE FUNCTION get_top_clients_stats(
    p_start_date timestamptz,
    p_end_date timestamptz,
    p_limit integer
)
RETURNS TABLE (
    customer_name text,
    total_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    RETURN QUERY
    SELECT 
        COALESCE(c.name, 'Cliente General') as customer_name,
        SUM(s.total) as total_sales
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date
      AND s.store_id = v_store_id
    GROUP BY c.id, c.name
    ORDER BY total_sales DESC
    LIMIT p_limit;
END;
$$;
