-- RPC update to fix customer deletion after removing profiles.customer_id column

CREATE OR REPLACE FUNCTION delete_customer_cascade(target_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Desvincular de ventas pasadas
  UPDATE public.sales 
  SET customer_id = NULL 
  WHERE customer_id = target_customer_id;
  
  -- 2. Desvincular de órdenes abiertas/pedidos
  UPDATE public.open_orders 
  SET customer_id = NULL 
  WHERE customer_id = target_customer_id;
  
  -- 3. Finalmente, eliminar el cliente de forma permanente
  DELETE FROM public.customers 
  WHERE id = target_customer_id;
  
END;
$$;
