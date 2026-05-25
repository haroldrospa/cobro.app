-- 1. Get Dashboard Metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  today_sales NUMERIC,
  yesterday_sales NUMERIC,
  today_count INTEGER,
  total_sales NUMERIC,
  avg_ticket NUMERIC,
  overdue_count INTEGER,
  low_stock INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Today's sales (in the passed range, assuming caller passes today's range)
    COALESCE(SUM(s.total) FILTER (WHERE s.created_at >= p_start_date AND s.created_at <= p_end_date), 0) as today_sales,
    
    -- Yesterday's sales (hardcoded comparison 24h before start date)
    COALESCE(SUM(s.total) FILTER (WHERE s.created_at >= (p_start_date - interval '1 day') AND s.created_at < p_start_date), 0) as yesterday_sales,
    
    -- Today's count
    COUNT(s.id) FILTER (WHERE s.created_at >= p_start_date AND s.created_at <= p_end_date)::INTEGER as today_count,
    
    -- Total sales (all time for store)
    COALESCE(SUM(s.total), 0) as total_sales,
    
    -- Average ticket (all time)
    COALESCE(AVG(s.total), 0) as avg_ticket,
    
    -- Overdue count (pending payments past due date)
    (SELECT COUNT(*)::INTEGER FROM public.sales 
     WHERE store_id = p_store_id 
     AND payment_status = 'pending' 
     AND due_date < NOW()),
     
    -- Low stock count
    (SELECT COUNT(*)::INTEGER FROM public.products 
     WHERE store_id = p_store_id 
     AND stock <= min_stock 
     AND status = 'active')
     
  FROM public.sales s
  WHERE s.store_id = p_store_id;
END;
$$;

-- 2. Get Top Products Stats
CREATE OR REPLACE FUNCTION public.get_top_products_stats(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER
)
RETURNS TABLE (
  product_name TEXT,
  quantity_sold NUMERIC,
  total_sales NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as product_name,
    SUM(si.quantity) as quantity_sold,
    SUM(si.total) as total_sales
  FROM public.sale_items si
  JOIN public.sales s ON si.sale_id = s.id
  JOIN public.products p ON si.product_id = p.id
  WHERE s.store_id = p_store_id
  AND s.created_at >= p_start_date 
  AND s.created_at <= p_end_date
  GROUP BY p.id, p.name
  ORDER BY total_sales DESC
  LIMIT p_limit;
END;
$$;

-- 3. Get Sales By Category Stats
CREATE OR REPLACE FUNCTION public.get_sales_by_category_stats(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  category_name TEXT,
  total_sales NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as category_name,
    SUM(si.total) as total_sales
  FROM public.sale_items si
  JOIN public.sales s ON si.sale_id = s.id
  JOIN public.products p ON si.product_id = p.id
  JOIN public.categories c ON p.category_id = c.id
  WHERE s.store_id = p_store_id
  AND s.created_at >= p_start_date 
  AND s.created_at <= p_end_date
  GROUP BY c.id, c.name
  ORDER BY total_sales DESC;
END;
$$;

-- 4. Get Monthly Sales Stats
CREATE OR REPLACE FUNCTION public.get_monthly_sales_stats(
  p_store_id UUID,
  p_year INTEGER
)
RETURNS TABLE (
  month_index INTEGER,
  total_sales NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CAST(EXTRACT(MONTH FROM created_at) AS INTEGER) - 1 as month_index,
    SUM(total) as total_sales
  FROM public.sales
  WHERE store_id = p_store_id
  AND EXTRACT(YEAR FROM created_at) = p_year
  GROUP BY month_index
  ORDER BY month_index ASC;
END;
$$;

-- 5. Get Hourly Sales Stats
CREATE OR REPLACE FUNCTION public.get_hourly_sales_stats(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  hour INTEGER,
  total_sales NUMERIC,
  usage_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CAST(EXTRACT(HOUR FROM created_at) AS INTEGER) as hour,
    SUM(total) as total_sales,
    COUNT(*)::INTEGER as usage_count
  FROM public.sales
  WHERE store_id = p_store_id
  AND created_at >= p_start_date 
  AND created_at <= p_end_date
  GROUP BY hour
  ORDER BY hour ASC;
END;
$$;

-- 6. Get Low Stock Products List
CREATE OR REPLACE FUNCTION public.get_low_stock_products_list(
  p_store_id UUID
)
RETURNS SETOF public.products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE store_id = p_store_id
  AND stock <= min_stock
  AND status = 'active'
  ORDER BY stock ASC;
END;
$$;

-- 7. Get High Credit Customers List
CREATE OR REPLACE FUNCTION public.get_high_credit_customers_list(
  p_store_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  credit_limit NUMERIC,
  credit_used NUMERIC,
  usage_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.credit_limit,
    c.credit_used,
    CASE WHEN c.credit_limit > 0 THEN (c.credit_used / c.credit_limit) * 100 ELSE 0 END as usage_percentage
  FROM public.customers c
  WHERE c.store_id = p_store_id
  AND c.credit_limit > 0
  AND (c.credit_used / c.credit_limit) > 0.8 -- > 80% used
  ORDER BY usage_percentage DESC;
END;
$$;

-- 8. Get Top Clients Stats
CREATE OR REPLACE FUNCTION public.get_top_clients_stats(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_limit INTEGER
)
RETURNS TABLE (
  customer_name TEXT,
  total_sales NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as customer_name,
    SUM(s.total) as total_sales
  FROM public.sales s
  JOIN public.customers c ON s.customer_id = c.id
  WHERE s.store_id = p_store_id
  AND s.created_at >= p_start_date 
  AND s.created_at <= p_end_date
  GROUP BY c.id, c.name
  ORDER BY total_sales DESC
  LIMIT p_limit;
END;
$$;

-- 9. Helper to update invoice sequence max (used by offlineSync)
CREATE OR REPLACE FUNCTION public.update_invoice_sequence_max(
  p_invoice_type_id TEXT,
  p_store_id UUID,
  p_new_sequence_number INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to update existing sequence if new number is higher
  UPDATE public.invoice_sequences
  SET current_number = p_new_sequence_number,
      updated_at = NOW()
  WHERE invoice_type_id = p_invoice_type_id
  AND store_id = p_store_id
  AND current_number < p_new_sequence_number;

  -- If no row found, it might simply not exist yet, so insert it
  -- (We use INSERT ... ON CONFLICT DO NOTHING purely as fallback if select failed above)
  IF NOT FOUND THEN
    INSERT INTO public.invoice_sequences (invoice_type_id, store_id, current_number)
    VALUES (p_invoice_type_id, p_store_id, p_new_sequence_number)
    ON CONFLICT (invoice_type_id, store_id) 
    DO UPDATE SET 
      current_number = GREATEST(invoice_sequences.current_number, EXCLUDED.current_number),
      updated_at = NOW();
  END IF;
END;
$$;
