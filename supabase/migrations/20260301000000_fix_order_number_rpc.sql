-- Fix generate_order_number to safely ignore non-numeric suffixes
CREATE OR REPLACE FUNCTION public.generate_order_number(order_source text DEFAULT 'pos')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_number TEXT;
  counter INTEGER;
  prefix TEXT;
  pattern TEXT;
BEGIN
  -- Determine prefix based on source
  IF order_source = 'web' THEN
    prefix := 'WEB-';
    pattern := 'WEB-%';
  ELSE
    prefix := 'POS-';
    pattern := 'POS-%';
  END IF;
  
  -- Get the next sequential number for this prefix
  -- Use a safe CASE to skip rows where the suffix is not a valid integer
  SELECT COALESCE(MAX(
    CASE 
      WHEN SUBSTRING(order_number FROM LENGTH(prefix) + 1) ~ '^[0-9]+$'
      THEN CAST(SUBSTRING(order_number FROM LENGTH(prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.open_orders
  WHERE order_number LIKE pattern;
  
  new_number := prefix || LPAD(counter::TEXT, 6, '0');
  RETURN new_number;
END;
$function$;
