-- RPC para poder eliminar cualquier producto sin que falle por historial
-- Ejecuta esto en el SQL Editor de Supabase y dale a "RUN"

CREATE OR REPLACE FUNCTION delete_product_cascade(target_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Esto salta las políticas RLS para poder actualizar facturas viejas
AS $$
BEGIN
  -- 1. Desvincular de los detalles de ventas pasadas (sale_items)
  UPDATE public.sale_items 
  SET product_id = NULL 
  WHERE product_id = target_product_id;
  
  -- 2. Desvincular de los detalles de órdenes abiertas (open_order_items)
  UPDATE public.open_order_items 
  SET product_id = NULL 
  WHERE product_id = target_product_id;
  
  -- 3. Eliminar ofertas asociadas permanentemente
  DELETE FROM public.product_offers 
  WHERE product_id = target_product_id;
  
  -- 4. Finalmente, eliminar el producto de forma permanente
  DELETE FROM public.products 
  WHERE id = target_product_id;
  
END;
$$;
