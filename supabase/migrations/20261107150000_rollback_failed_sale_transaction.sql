-- Función atómica para revertir ventas no firmadas por la DGII
-- Evita el consumo y desperdicio de secuencias e-NCF y restaura el inventario
CREATE OR REPLACE FUNCTION public.rollback_failed_sale_transaction(
  p_sale_id UUID,
  p_reason TEXT DEFAULT 'Fiscal signature failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_num_match TEXT;
  v_used_seq INTEGER;
  v_seq RECORD;
BEGIN
  -- 1. Obtener la venta
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Sale not found or already deleted');
  END IF;

  -- 2. Restaurar stock de inventario
  FOR v_item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id AND product_id IS NOT NULL LOOP
    UPDATE public.products 
    SET stock = COALESCE(stock, 0) + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- 3. Revertir secuencia si este comprobante fue el último número incrementado
  IF v_sale.invoice_number IS NOT NULL AND v_sale.invoice_type_id IS NOT NULL AND v_sale.store_id IS NOT NULL THEN
    v_num_match := SUBSTRING(v_sale.invoice_number FROM '([0-9]+)$');
    IF v_num_match IS NOT NULL THEN
      v_used_seq := v_num_match::INTEGER;
      SELECT id, current_number INTO v_seq 
      FROM public.invoice_sequences 
      WHERE store_id = v_sale.store_id AND invoice_type_id = v_sale.invoice_type_id
      FOR UPDATE;

      IF v_seq.id IS NOT NULL AND v_seq.current_number = v_used_seq THEN
        UPDATE public.invoice_sequences 
        SET current_number = GREATEST(0, v_used_seq - 1),
            updated_at = NOW()
        WHERE id = v_seq.id;
      END IF;
    END IF;
  END IF;

  -- 4. Eliminar items y venta
  DELETE FROM public.sale_items WHERE sale_id = p_sale_id;
  DELETE FROM public.sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'rolled_back_id', p_sale_id,
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_failed_sale_transaction(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
