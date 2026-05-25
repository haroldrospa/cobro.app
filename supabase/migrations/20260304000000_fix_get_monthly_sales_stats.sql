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
  AND status != 'cancelled'
  AND EXTRACT(YEAR FROM created_at) = p_year
  GROUP BY month_index
  ORDER BY month_index ASC;
END;
$$;
