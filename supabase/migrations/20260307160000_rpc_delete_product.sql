CREATE OR REPLACE FUNCTION delete_product_cascade(target_product_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nullify in sale_items
  UPDATE public.sale_items SET product_id = NULL WHERE product_id = target_product_id;
  
  -- Nullify in open_order_items
  UPDATE public.open_order_items SET product_id = NULL WHERE product_id = target_product_id;
  
  -- Delete product offers
  DELETE FROM public.product_offers WHERE product_id = target_product_id;
  
  -- Delete the product itself
  DELETE FROM public.products WHERE id = target_product_id;
END;
$$;
