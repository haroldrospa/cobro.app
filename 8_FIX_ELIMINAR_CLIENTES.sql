-- RPC para poder eliminar clientes sin errores de foreign keys de ventas/órdenes
-- Ejecuta esto en el SQL Editor de Supabase y dale a "RUN"

CREATE OR REPLACE FUNCTION delete_customer_cascade(target_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Esto salta las políticas RLS para poder desvincular sin fallos
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
