-- Drop the existing function and recreate with source parameter
DROP FUNCTION IF EXISTS public.generate_order_number();

-- Create new function that accepts source parameter
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
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM LENGTH(prefix) + 1) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.open_orders
  WHERE order_number LIKE pattern;
  
  new_number := prefix || LPAD(counter::TEXT, 6, '0');
  RETURN new_number;
END;
$function$;