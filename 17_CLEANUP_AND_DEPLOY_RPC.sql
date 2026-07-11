-- =========================================================================
-- MIGRACIÓN 17: LIMPIEZA DE TRIGGERS Y DESPLIEGUE DE TRANSACCIÓN ATÓMICA DE VENTA V3
-- Ejecutar en Supabase SQL Editor
-- =========================================================================

-- 1. LIMPIEZA DE TRIGGERS HUÉRFANOS REFERENCIANDO 'recipe_ingredients' (QUE CAUSA EL ERROR DE CHECKOUT)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Eliminar triggers cuyas funciones utilicen la palabra 'recipe_ingredients'
    FOR r IN (
        SELECT DISTINCT t.tgname, c.relname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE p.prosrc ILIKE '%recipe_ingredients%' AND n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.' || quote_ident(r.relname) || ' CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;

    -- Eliminar funciones que hagan referencia a 'recipe_ingredients'
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosrc ILIKE '%recipe_ingredients%' AND n.nspname = 'public'
    ) LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE;';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;


-- 2. DESPLIEGUE DE LA FUNCIÓN DE TRANSACCIÓN ATÓMICA DE VENTA V3

-- Eliminar la versión anterior con parámetro UUID si existía para evitar firmas conflictivas
DROP FUNCTION IF EXISTS public.create_sale_transaction_v3(
  UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, JSONB
);

CREATE OR REPLACE FUNCTION public.create_sale_transaction_v3(
  p_sale_id UUID,
  p_customer_id UUID,
  p_invoice_type_id TEXT, -- Soportar códigos como 'B01', 'B02'
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
  v_is_electronic_active BOOLEAN := FALSE;
  v_seq_id UUID;
  v_current_number INT;
  v_next_number INT;
  v_display_prefix TEXT;
  v_separator TEXT := '-';
  v_padding INT := 8;
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
  v_current_stock NUMERIC;
  v_new_stock NUMERIC;
  v_inserted_sale RECORD;
  v_real_max INT;
BEGIN
  -- 1. Verificar si la venta ya fue registrada (Idempotencia)
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

  -- 2. Resolver el código tradicional del tipo de factura
  SELECT code INTO v_invoice_type_code FROM public.invoice_types WHERE id = p_invoice_type_id;
  IF v_invoice_type_code IS NULL THEN
     v_invoice_type_code := p_invoice_type_id;
  END IF;

  -- 3. Verificar si la facturación electrónica (e-NCF) está activa para esta tienda
  SELECT COALESCE(is_active, FALSE) INTO v_is_electronic_active 
  FROM public.alanube_config 
  WHERE store_id = p_store_id LIMIT 1;

  -- 4. Bloquear y obtener secuencia actual para evitar duplicación bajo concurrencia
  SELECT id, current_number INTO v_seq_id, v_current_number 
  FROM public.invoice_sequences 
  WHERE invoice_type_id = v_invoice_type_code AND store_id = p_store_id 
  FOR UPDATE;

  IF v_seq_id IS NULL THEN
     -- Auto-reparación: Si no existe, buscar el máximo real usado en ventas
     SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '-([0-9]{1,9})$')::INTEGER), 0) INTO v_current_number
     FROM public.sales
     WHERE store_id = p_store_id 
       AND invoice_type_id = p_invoice_type_id
       AND invoice_number NOT LIKE '%OFFLINE%';

     v_next_number := v_current_number + 1;
     
     INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
     VALUES (v_invoice_type_code, v_next_number, p_store_id)
     RETURNING id INTO v_seq_id;
  ELSE
     -- Auto-reparación agresiva: Aún si existe la secuencia, podría estar desfasada (ej. ventas offline previas)
     SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '-([0-9]{1,9})$')::INTEGER), 0) INTO v_real_max
     FROM public.sales
     WHERE store_id = p_store_id 
       AND invoice_type_id = p_invoice_type_id
       AND invoice_number NOT LIKE '%OFFLINE%';

     IF v_real_max > v_current_number THEN
        v_current_number := v_real_max;
     END IF;

     v_next_number := v_current_number + 1;
     UPDATE public.invoice_sequences 
     SET current_number = v_next_number, updated_at = NOW() 
     WHERE id = v_seq_id;
  END IF;

  -- 5. Formatear número de factura según sea tradicional o electrónica (e-NCF)
  v_display_prefix := v_invoice_type_code;
  IF v_is_electronic_active THEN
     v_separator := '';
     v_padding := 10;
     CASE v_invoice_type_code
       WHEN 'B01' THEN v_display_prefix := 'E31';
       WHEN 'B02' THEN v_display_prefix := 'E32';
       WHEN 'B03' THEN v_display_prefix := 'E33';
       WHEN 'B04' THEN v_display_prefix := 'E34';
       WHEN 'B14' THEN v_display_prefix := 'E44';
       WHEN 'B15' THEN v_display_prefix := 'E45';
       WHEN 'B16' THEN v_display_prefix := 'E46';
       ELSE NULL;
     END CASE;
  END IF;

  v_invoice_number := v_display_prefix || v_separator || LPAD(v_next_number::text, v_padding, '0');

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
    p_invoice_type_id,
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
    
    -- Distribuir descuento global proporcionalmente
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

    -- Registrar item de la venta
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

    -- Descontar inventario del producto
    UPDATE public.products 
    SET stock = GREATEST(0, COALESCE(stock, 0) - v_quantity),
        updated_at = NOW()
    WHERE id = v_product_id;

    -- Descontar ingredientes de receta si existen (Usa dynamic SQL para evitar errores si no existen las tablas)
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

-- Habilitar permisos de ejecución para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.create_sale_transaction_v3(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, JSONB
) TO authenticated;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
