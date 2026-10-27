-- =========================================================================
-- MIGRACIÓN: Separación Completa de Secuencias Fiscales (NCF) y Electrónicas (e-CF)
-- =========================================================================

-- 1. Asegurar que los tipos de factura electrónica existan en public.invoice_types
INSERT INTO public.invoice_types (id, code, name, description) VALUES
  ('E31', 'E31', 'Crédito Fiscal Electrónico', 'Factura de Crédito Fiscal Electrónica (e-CF)'),
  ('E32', 'E32', 'Consumidor Final Electrónico', 'Factura de Consumo Electrónica (e-CF)'),
  ('E33', 'E33', 'Nota de Débito Electrónica', 'Nota de Débito Electrónica (e-CF)'),
  ('E34', 'E34', 'Nota de Crédito Electrónica', 'Nota de Crédito Electrónica (e-CF)'),
  ('E41', 'E41', 'Comprobante de Compras Electrónico', 'Comprobante de Compras Electrónico (e-CF)'),
  ('E44', 'E44', 'Régimen Especial Electrónico', 'Comprobante para Regímenes Especiales Electrónico (e-CF)'),
  ('E45', 'E45', 'Gubernamental Electrónico', 'Comprobante Gubernamental Electrónico (e-CF)'),
  ('E46', 'E46', 'Exportación Electrónica', 'Comprobante de Exportación Electrónico (e-CF)')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description;

-- 2. Asegurar que cada tienda tenga sus secuencias electrónicas (E31..E46) aisladas en public.invoice_sequences
DO $$
DECLARE
    tienda RECORD;
    tipo_e TEXT;
    tipos_e TEXT[] := ARRAY['E31', 'E32', 'E33', 'E34', 'E41', 'E44', 'E45', 'E46'];
    v_max_usado INT;
BEGIN
    FOR tienda IN SELECT id FROM public.stores LOOP
        FOREACH tipo_e IN ARRAY tipos_e LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.invoice_sequences 
                WHERE store_id = tienda.id AND invoice_type_id = tipo_e
            ) THEN
                -- Buscar si ya existía alguna venta electrónica previa para no reiniciar
                SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 'E[0-9]{2}([0-9]+)$')::INTEGER), 0)
                INTO v_max_usado
                FROM public.sales
                WHERE store_id = tienda.id AND (invoice_type_id = tipo_e OR invoice_number LIKE tipo_e || '%');

                INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
                VALUES (tipo_e, v_max_usado, tienda.id);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 3. Actualizar función atómica create_sale_transaction_v3 para aislar secuencias B vs E
CREATE OR REPLACE FUNCTION public.create_sale_transaction_v3(
  p_sale_id UUID,
  p_customer_id UUID,
  p_invoice_type_id TEXT,
  p_subtotal NUMERIC,
  p_discount_total NUMERIC,
  p_tax_total NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_amount_received NUMERIC,
  p_change_amount NUMERIC,
  p_split_cash NUMERIC,
  p_split_method TEXT,
  p_payment_status TEXT,
  p_due_date TIMESTAMPTZ,
  p_store_id UUID,
  p_profile_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number TEXT;
  v_invoice_type_code TEXT;
  v_target_seq_type TEXT;
  v_is_electronic_active BOOLEAN := FALSE;
  v_seq_id UUID;
  v_current_number INT;
  v_next_number INT;
  v_item RECORD;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_tax_rate NUMERIC;
  v_cost_includes_tax BOOLEAN;
  v_item_subtotal NUMERIC;
  v_item_discount_amount NUMERIC;
  v_item_discount_percentage NUMERIC;
  v_item_after_discount NUMERIC;
  v_item_tax_amount NUMERIC;
  v_item_total NUMERIC;
  v_inserted_sale RECORD;
BEGIN
  -- 1. Idempotencia
  SELECT * INTO v_inserted_sale FROM public.sales WHERE id = p_sale_id;
  IF FOUND THEN
     RETURN jsonb_build_object(
       'id', v_inserted_sale.id,
       'invoice_number', v_inserted_sale.invoice_number,
       'customer_id', v_inserted_sale.customer_id,
       'invoice_type_id', v_inserted_sale.invoice_type_id,
       'subtotal', v_inserted_sale.subtotal,
       'discount_total', v_inserted_sale.discount_total,
       'tax_total', v_inserted_sale.tax_total,
       'total', v_inserted_sale.total,
       'payment_method', v_inserted_sale.payment_method,
       'amount_received', v_inserted_sale.amount_received,
       'change_amount', v_inserted_sale.change_amount,
       'split_cash', v_inserted_sale.split_cash,
       'split_method', v_inserted_sale.split_method,
       'payment_status', v_inserted_sale.payment_status,
       'due_date', v_inserted_sale.due_date,
       'store_id', v_inserted_sale.store_id,
       'profile_id', v_inserted_sale.profile_id,
       'created_at', v_inserted_sale.created_at,
       'already_existed', TRUE
     );
  END IF;

  -- 2. Resolver código
  SELECT code INTO v_invoice_type_code FROM public.invoice_types WHERE id = p_invoice_type_id;
  IF v_invoice_type_code IS NULL THEN
     v_invoice_type_code := p_invoice_type_id;
  END IF;

  -- 3. Verificar si e-NCF está activo para esta tienda
  SELECT COALESCE(is_active, FALSE) INTO v_is_electronic_active 
  FROM public.alanube_config 
  WHERE store_id = p_store_id LIMIT 1;

  -- Determinar tipo de secuencia destino
  v_target_seq_type := v_invoice_type_code;
  IF v_is_electronic_active AND v_invoice_type_code NOT IN ('FAC', 'COT') THEN
     CASE v_invoice_type_code
       WHEN 'B01' THEN v_target_seq_type := 'E31';
       WHEN 'B02' THEN v_target_seq_type := 'E32';
       WHEN 'B03' THEN v_target_seq_type := 'E33';
       WHEN 'B04' THEN v_target_seq_type := 'E34';
       WHEN 'B11' THEN v_target_seq_type := 'E41';
       WHEN 'B14' THEN v_target_seq_type := 'E44';
       WHEN 'B15' THEN v_target_seq_type := 'E45';
       WHEN 'B16' THEN v_target_seq_type := 'E46';
       ELSE NULL;
     END CASE;
  END IF;

  -- 4. Bloquear y obtener secuencia propia del tipo destino (E32 o B02)
  SELECT id, current_number INTO v_seq_id, v_current_number 
  FROM public.invoice_sequences 
  WHERE invoice_type_id = v_target_seq_type AND store_id = p_store_id 
  FOR UPDATE;

  IF v_seq_id IS NULL THEN
     IF v_target_seq_type LIKE 'E%' THEN
       SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 'E[0-9]{2}([0-9]+)$')::INTEGER), 0) INTO v_current_number
       FROM public.sales
       WHERE store_id = p_store_id AND (invoice_type_id = v_target_seq_type OR invoice_number LIKE v_target_seq_type || '%');
     ELSE
       SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '-([0-9]+)$')::INTEGER), 0) INTO v_current_number
       FROM public.sales
       WHERE store_id = p_store_id AND invoice_type_id = v_target_seq_type;
     END IF;

     v_next_number := v_current_number + 1;
     
     INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
     VALUES (v_target_seq_type, v_next_number, p_store_id)
     RETURNING id INTO v_seq_id;
  ELSE
     v_next_number := v_current_number + 1;
     UPDATE public.invoice_sequences 
     SET current_number = v_next_number, updated_at = NOW() 
     WHERE id = v_seq_id;
  END IF;

  -- 5. Formatear número de factura según tipo
  IF v_target_seq_type LIKE 'E%' THEN
     v_invoice_number := v_target_seq_type || LPAD(v_next_number::text, 10, '0');
  ELSE
     v_invoice_number := v_target_seq_type || '-' || LPAD(v_next_number::text, 8, '0');
  END IF;

  -- 6. Insertar Venta
  INSERT INTO public.sales (
    id,
    invoice_number,
    customer_id,
    invoice_type_id,
    subtotal,
    discount_total,
    tax_total,
    total,
    payment_method,
    amount_received,
    change_amount,
    split_cash,
    split_method,
    payment_status,
    due_date,
    store_id,
    profile_id,
    created_at
  ) VALUES (
    p_sale_id,
    v_invoice_number,
    p_customer_id,
    v_target_seq_type,
    p_subtotal,
    p_discount_total,
    p_tax_total,
    p_total,
    p_payment_method,
    p_amount_received,
    p_change_amount,
    p_split_cash,
    p_split_method,
    p_payment_status,
    p_due_date,
    p_store_id,
    p_profile_id,
    NOW()
  ) RETURNING * INTO v_inserted_sale;

  -- 7. Insertar Items, Descontar Stock y Recetas
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    id UUID,
    price NUMERIC,
    quantity NUMERIC,
    tax NUMERIC,
    cost_includes_tax BOOLEAN
  ) LOOP
    v_product_id := v_item.id;
    v_quantity := v_item.quantity;
    v_unit_price := v_item.price;
    v_tax_rate := COALESCE(v_item.tax, 0.18);
    v_cost_includes_tax := COALESCE(v_item.cost_includes_tax, FALSE);

    v_item_subtotal := v_unit_price * v_quantity;
    
    IF p_subtotal > 0 THEN
       v_item_discount_amount := p_discount_total * (v_item_subtotal / p_subtotal);
    ELSE
       v_item_discount_amount := 0;
    END IF;

    IF v_item_subtotal > 0 THEN
       v_item_discount_percentage := (v_item_discount_amount / v_item_subtotal) * 100;
    ELSE
       v_item_discount_percentage := 0;
    END IF;

    v_item_after_discount := v_item_subtotal - v_item_discount_amount;

    IF v_cost_includes_tax THEN
       v_item_total := v_item_after_discount;
       v_item_tax_amount := v_item_total - (v_item_total / (1 + v_tax_rate));
    ELSE
       v_item_tax_amount := v_item_after_discount * v_tax_rate;
       v_item_total := v_item_after_discount + v_item_tax_amount;
    END IF;

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount_percentage,
      tax_percentage,
      subtotal,
      discount_amount,
      tax_amount,
      total
    ) VALUES (
      p_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_item_discount_percentage,
      v_tax_rate * 100,
      v_item_subtotal,
      v_item_discount_amount,
      v_item_tax_amount,
      v_item_total
    );

    UPDATE public.products 
    SET stock = GREATEST(0, COALESCE(stock, 0) - v_quantity),
        updated_at = NOW()
    WHERE id = v_product_id;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'product_recipes'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'restaurant_ingredients'
    ) THEN
       EXECUTE '
         UPDATE public.restaurant_ingredients ri
         SET stock = GREATEST(0, ri.stock - ($1 * pr.quantity)),
             updated_at = NOW()
         FROM public.product_recipes pr
         WHERE pr.ingredient_id = ri.id AND pr.product_id = $2
       ' USING v_quantity, v_product_id;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'id', v_inserted_sale.id,
    'invoice_number', v_inserted_sale.invoice_number,
    'customer_id', v_inserted_sale.customer_id,
    'invoice_type_id', v_inserted_sale.invoice_type_id,
    'subtotal', v_inserted_sale.subtotal,
    'discount_total', v_inserted_sale.discount_total,
    'tax_total', v_inserted_sale.tax_total,
    'total', v_inserted_sale.total,
    'payment_method', v_inserted_sale.payment_method,
    'amount_received', v_inserted_sale.amount_received,
    'change_amount', v_inserted_sale.change_amount,
    'split_cash', v_inserted_sale.split_cash,
    'split_method', v_inserted_sale.split_method,
    'payment_status', v_inserted_sale.payment_status,
    'due_date', v_inserted_sale.due_date,
    'store_id', v_inserted_sale.store_id,
    'profile_id', v_inserted_sale.profile_id,
    'created_at', v_inserted_sale.created_at,
    'is_electronic_active', v_is_electronic_active
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale_transaction_v3(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, JSONB
) TO authenticated;

NOTIFY pgrst, 'reload schema';
