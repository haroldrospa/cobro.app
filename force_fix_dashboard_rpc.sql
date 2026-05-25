-- =========================================================
-- FORCE FIX DASHBOARD FUNCTIONS
-- 1. Drops existing functions to prevent signature conflicts
-- 2. Recreates them with correct parameters and isolation
-- =========================================================

-- 1. DROP functions first (to avoid Ambiguous Function errors)
DROP FUNCTION IF EXISTS get_dashboard_metrics(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_monthly_sales_stats(integer);
DROP FUNCTION IF EXISTS get_sales_by_category_stats(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_top_products_stats(timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS get_hourly_sales_stats(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_low_stock_products_list();
DROP FUNCTION IF EXISTS get_high_credit_customers_list();
DROP FUNCTION IF EXISTS get_top_clients_stats(timestamptz, timestamptz, integer);

-- 2. Recreate get_dashboard_metrics
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date timestamptz,
    p_end_date timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Get store_id
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();

    -- Return valid empty JSON if no store found (safety)
    IF v_store_id IS NULL THEN
         RETURN json_build_object(
            'total_sales', 0, 'total_count', 0, 'avg_ticket', 0,
            'today_sales', 0, 'today_count', 0, 'yesterday_sales', 0,
            'active_products', 0, 'low_stock', 0, 'overdue_count', 0
        );
    END IF;

    -- Dates
    v_today_start := date_trunc('day', now());
    v_yesterday_start := date_trunc('day', now() - interval '1 day');
    v_yesterday_end := v_today_start - interval '1 second';
    
    -- Metrics
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_total_sales, v_total_count 
    FROM sales WHERE created_at BETWEEN p_start_date AND p_end_date AND store_id = v_store_id;

    IF v_total_count > 0 THEN v_avg_ticket := v_total_sales / v_total_count; ELSE v_avg_ticket := 0; END IF;

    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_today_sales, v_today_count 
    FROM sales WHERE created_at >= v_today_start AND store_id = v_store_id;

    SELECT COALESCE(SUM(total), 0) INTO v_yesterday_sales
    FROM sales WHERE created_at BETWEEN v_yesterday_start AND v_yesterday_end AND store_id = v_store_id;

    SELECT COUNT(*) INTO v_active_products FROM products WHERE status = 'active' AND store_id = v_store_id;
    SELECT COUNT(*) INTO v_low_stock FROM products WHERE status = 'active' AND stock <= min_stock AND store_id = v_store_id;

    SELECT COUNT(DISTINCT customer_id) INTO v_overdue_count 
    FROM sales 
    WHERE payment_status = 'pending' AND due_date < now() AND customer_id IS NOT NULL AND store_id = v_store_id;

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

-- 3. Recreate get_monthly_sales_stats
CREATE OR REPLACE FUNCTION get_monthly_sales_stats(p_year integer)
RETURNS TABLE (month_index integer, total_sales numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT EXTRACT(MONTH FROM created_at)::integer - 1, SUM(total)
    FROM sales WHERE EXTRACT(YEAR FROM created_at) = p_year AND store_id = v_store_id
    GROUP BY 1 ORDER BY 1;
END;
$$;

-- 4. Recreate get_sales_by_category_stats
CREATE OR REPLACE FUNCTION get_sales_by_category_stats(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (category_name text, total_sales numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT c.name, SUM(si.total)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date AND s.store_id = v_store_id
    GROUP BY c.name ORDER BY 2 DESC LIMIT 10;
END;
$$;

-- 5. Recreate get_top_products_stats
CREATE OR REPLACE FUNCTION get_top_products_stats(p_start_date timestamptz, p_end_date timestamptz, p_limit integer)
RETURNS TABLE (product_name text, quantity_sold numeric, total_sales numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT p.name, SUM(si.quantity)::numeric, SUM(si.total)
    FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date AND s.store_id = v_store_id
    GROUP BY p.id, p.name ORDER BY 3 DESC LIMIT p_limit;
END;
$$;

-- 6. Recreate get_hourly_sales_stats
CREATE OR REPLACE FUNCTION get_hourly_sales_stats(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (hour integer, total_sales numeric, usage_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT EXTRACT(HOUR FROM created_at)::integer, SUM(total), COUNT(*)
    FROM sales WHERE created_at BETWEEN p_start_date AND p_end_date AND store_id = v_store_id
    GROUP BY 1 ORDER BY 1;
END;
$$;

-- 7. Recreate get_low_stock_products_list
CREATE OR REPLACE FUNCTION get_low_stock_products_list()
RETURNS TABLE (id uuid, name text, stock numeric, min_stock numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT p.id, p.name, p.stock, p.min_stock
    FROM products p WHERE p.status = 'active' AND p.stock <= p.min_stock AND p.store_id = v_store_id LIMIT 50;
END;
$$;

-- 8. Recreate get_high_credit_customers_list
CREATE OR REPLACE FUNCTION get_high_credit_customers_list()
RETURNS TABLE (id uuid, name text, credit_limit numeric, credit_used numeric, usage_percentage numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT c.id, c.name, c.credit_limit, c.credit_used, ROUND((c.credit_used / c.credit_limit) * 100)
    FROM customers c WHERE c.credit_limit > 0 AND (c.credit_used / c.credit_limit) >= 0.8 AND c.store_id = v_store_id;
END;
$$;

-- 9. Recreate get_top_clients_stats
CREATE OR REPLACE FUNCTION get_top_clients_stats(p_start_date timestamptz, p_end_date timestamptz, p_limit integer)
RETURNS TABLE (customer_name text, total_sales numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_store_id UUID;
BEGIN
    SELECT store_id INTO v_store_id FROM profiles WHERE id = auth.uid();
    RETURN QUERY SELECT COALESCE(c.name, 'Cliente General'), SUM(s.total)
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.created_at BETWEEN p_start_date AND p_end_date AND s.store_id = v_store_id
    GROUP BY c.id, c.name ORDER BY 2 DESC LIMIT p_limit;
END;
$$;
