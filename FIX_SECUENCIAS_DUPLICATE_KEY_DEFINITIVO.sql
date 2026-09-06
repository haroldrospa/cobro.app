-- =========================================================================
-- SCRIPT DE CORRECCIÓN DEFINITIVA: SECUENCIAS Y ERROR DUPLICATE KEY
-- Ejecuta todo este script en el SQL Editor de Supabase (https://supabase.com/dashboard)
-- =========================================================================

-- 1. CORREGIR CONSTRAINTS EN TABLA SALES
DO $$
BEGIN
    -- Eliminar constraint único global en invoice_number si existe
    BEGIN
        ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Crear índice único compuesto por (store_id, invoice_number) si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'sales_store_invoice_unique_idx' AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX sales_store_invoice_unique_idx ON public.sales (store_id, invoice_number) WHERE store_id IS NOT NULL;
        RAISE NOTICE '✅ Índice único por tienda (store_id, invoice_number) creado en tabla sales';
    END IF;
END $$;


-- 2. CORREGIR CONSTRAINTS Y LIMPIAR DUPLICADOS EN TABLA INVOICE_SEQUENCES
DO $$
DECLARE
    duplicado RECORD;
    tienda RECORD;
    tipo TEXT;
    tipos_factura TEXT[] := ARRAY['B01', 'B02', 'B03', 'B14', 'B15', 'B16'];
    primera_tienda UUID;
    sec_huerfana RECORD;
    seq RECORD;
    num_maximo INTEGER;
BEGIN
    -- 2.1 Eliminar constraint antiguo que impedía secuencias por tienda
    BEGIN
        ALTER TABLE public.invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_invoice_type_id_key;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 2.2 Asignar primera tienda a secuencias huérfanas si existen
    SELECT id INTO primera_tienda FROM public.stores ORDER BY created_at LIMIT 1;
    IF primera_tienda IS NOT NULL THEN
        FOR sec_huerfana IN SELECT id, invoice_type_id FROM public.invoice_sequences WHERE store_id IS NULL LOOP
            IF EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = sec_huerfana.invoice_type_id AND store_id = primera_tienda) THEN
                DELETE FROM public.invoice_sequences WHERE id = sec_huerfana.id;
            ELSE
                UPDATE public.invoice_sequences SET store_id = primera_tienda WHERE id = sec_huerfana.id;
            END IF;
        END LOOP;
    END IF;

    -- 2.3 Eliminar filas duplicadas conservando el número más alto
    FOR duplicado IN 
        SELECT invoice_type_id, store_id, ARRAY_AGG(id ORDER BY current_number DESC) as ids
        FROM public.invoice_sequences
        WHERE store_id IS NOT NULL
        GROUP BY invoice_type_id, store_id
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM public.invoice_sequences WHERE id = ANY(duplicado.ids[2:]);
    END LOOP;

    -- 2.4 Asegurar constraint único compuesto (invoice_type_id, store_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoice_sequences_type_store_unique'
    ) THEN
        ALTER TABLE public.invoice_sequences 
        ADD CONSTRAINT invoice_sequences_type_store_unique 
        UNIQUE (invoice_type_id, store_id);
    END IF;

    -- 2.5 Crear secuencias faltantes para todas las tiendas
    FOR tienda IN SELECT id FROM public.stores LOOP
        FOREACH tipo IN ARRAY tipos_factura LOOP
            IF NOT EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = tipo AND store_id = tienda.id) THEN
                INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
                VALUES (tipo, 0, tienda.id);
            END IF;
        END LOOP;
    END LOOP;

    -- 2.6 Sincronizar secuencias con las ventas existentes
    FOR seq IN SELECT id, invoice_type_id, store_id, current_number FROM public.invoice_sequences WHERE store_id IS NOT NULL LOOP
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(invoice_number FROM '(\d+)$') AS INTEGER)), 
            0
        ) INTO num_maximo
        FROM public.sales
        WHERE (store_id = seq.store_id OR (seq.store_id = primera_tienda AND store_id IS NULL))
          AND (
            invoice_type_id = seq.invoice_type_id 
            OR invoice_number LIKE seq.invoice_type_id || '-%'
            OR (seq.invoice_type_id = 'B01' AND invoice_number LIKE 'E31%')
            OR (seq.invoice_type_id = 'B02' AND invoice_number LIKE 'E32%')
            OR (seq.invoice_type_id = 'B03' AND invoice_number LIKE 'E33%')
            OR (seq.invoice_type_id = 'B04' AND invoice_number LIKE 'E34%')
            OR (seq.invoice_type_id = 'B14' AND invoice_number LIKE 'E44%')
            OR (seq.invoice_type_id = 'B15' AND invoice_number LIKE 'E45%')
            OR (seq.invoice_type_id = 'B16' AND invoice_number LIKE 'E46%')
          );

        IF num_maximo > seq.current_number THEN
            UPDATE public.invoice_sequences
            SET current_number = num_maximo, updated_at = NOW()
            WHERE id = seq.id;
        END IF;
    END LOOP;

    RAISE NOTICE '✅ Secuencias corregidas y sincronizadas con las facturas existentes';
END $$;


-- 3. ACTUALIZAR FUNCIÓN GET_NEXT_INVOICE_NUMBER CON ANTI-COLISIÓN
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(invoice_type_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  formatted_number text;
  user_store_id uuid;
  display_prefix text;
  separator text := '-';
  padding int := 8;
  is_elec boolean := false;
BEGIN
  -- Obtener la tienda del usuario actual
  SELECT store_id INTO user_store_id 
  FROM public.profiles 
  WHERE id = auth.uid();

  IF user_store_id IS NULL THEN
    -- Fallback: primera tienda si no tiene
    SELECT id INTO user_store_id FROM public.stores ORDER BY created_at LIMIT 1;
  END IF;

  -- 1. Obtener o crear secuencia
  SELECT current_number INTO next_number
  FROM public.invoice_sequences
  WHERE invoice_type_id = invoice_type_code AND store_id = user_store_id
  FOR UPDATE;

  IF next_number IS NULL THEN
    next_number := 1;
    INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
    VALUES (invoice_type_code, next_number, user_store_id)
    ON CONFLICT (invoice_type_id, store_id) 
    DO UPDATE SET current_number = invoice_sequences.current_number + 1
    RETURNING current_number INTO next_number;
  ELSE
    next_number := next_number + 1;
  END IF;

  -- 2. Verificar si e-NCF está activo
  SELECT COALESCE(is_active, FALSE) INTO is_elec 
  FROM public.alanube_config 
  WHERE store_id = user_store_id LIMIT 1;

  display_prefix := invoice_type_code;
  IF is_elec THEN
     separator := '';
     padding := 10;
     CASE invoice_type_code
       WHEN 'B01' THEN display_prefix := 'E31';
       WHEN 'B02' THEN display_prefix := 'E32';
       WHEN 'B03' THEN display_prefix := 'E33';
       WHEN 'B04' THEN display_prefix := 'E34';
       WHEN 'B14' THEN display_prefix := 'E44';
       WHEN 'B15' THEN display_prefix := 'E45';
       WHEN 'B16' THEN display_prefix := 'E46';
       ELSE NULL;
     END CASE;
  END IF;

  -- 3. Bucle Anti-Colisión: Garantizar que el número NO existe en sales
  LOOP
    formatted_number := display_prefix || separator || LPAD(next_number::text, padding, '0');
    IF NOT EXISTS (
      SELECT 1 FROM public.sales 
      WHERE invoice_number = formatted_number 
        AND (store_id = user_store_id OR store_id IS NULL)
    ) THEN
      EXIT;
    END IF;
    next_number := next_number + 1;
  END LOOP;

  -- 4. Guardar secuencia final
  UPDATE public.invoice_sequences
  SET current_number = next_number, updated_at = NOW()
  WHERE invoice_type_id = invoice_type_code AND store_id = user_store_id;

  RETURN formatted_number;
END;
$$;


-- 4. ACTUALIZAR FUNCIÓN ATÓMICA CREATE_SALE_TRANSACTION_V3 CON ANTI-COLISIÓN
DROP FUNCTION IF EXISTS public.create_sale_transaction_v3(
  UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, JSONB
);

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
  v_inserted_sale RECORD;
BEGIN
  -- 1. Verificar si la venta ya fue registrada (Idempotencia por ID)
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

  -- 2. Resolver el código del tipo de factura
  SELECT code INTO v_invoice_type_code FROM public.invoice_types WHERE id = p_invoice_type_id;
  IF v_invoice_type_code IS NULL THEN
     v_invoice_type_code := p_invoice_type_id;
  END IF;

  -- 3. Verificar si facturación electrónica está activa
  SELECT COALESCE(is_active, FALSE) INTO v_is_electronic_active 
  FROM public.alanube_config 
  WHERE store_id = p_store_id LIMIT 1;

  -- 4. Bloquear y obtener secuencia actual
  SELECT id, current_number INTO v_seq_id, v_current_number 
  FROM public.invoice_sequences 
  WHERE invoice_type_id = v_invoice_type_code AND store_id = p_store_id 
  FOR UPDATE;

  IF v_seq_id IS NULL THEN
     SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '(\d+)$') AS INTEGER)), 0) INTO v_current_number
     FROM public.sales
     WHERE store_id = p_store_id;

     v_next_number := v_current_number + 1;
  ELSE
     v_next_number := v_current_number + 1;
  END IF;

  -- 5. Formatear prefijo
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

  -- 6. Bucle Anti-Colisión: Asegurar número que NO existe en la base de datos
  LOOP
    v_invoice_number := v_display_prefix || v_separator || LPAD(v_next_number::text, v_padding, '0');
    IF NOT EXISTS (
      SELECT 1 FROM public.sales 
      WHERE invoice_number = v_invoice_number 
        AND (store_id = p_store_id OR store_id IS NULL)
    ) THEN
      EXIT;
    END IF;
    v_next_number := v_next_number + 1;
  END LOOP;

  -- 7. Actualizar o insertar la secuencia con el número garantizado
  IF v_seq_id IS NOT NULL THEN
     UPDATE public.invoice_sequences 
     SET current_number = v_next_number, updated_at = NOW() 
     WHERE id = v_seq_id;
  ELSE
     INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
     VALUES (v_invoice_type_code, v_next_number, p_store_id)
     ON CONFLICT (invoice_type_id, store_id) 
     DO UPDATE SET current_number = EXCLUDED.current_number, updated_at = NOW()
     RETURNING id INTO v_seq_id;
  END IF;

  -- 8. Insertar la Venta de forma segura
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
    created_at,
    store_id,
    profile_id
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
    NOW(),
    p_store_id,
    p_profile_id
  ) RETURNING * INTO v_inserted_sale;

  -- 9. Insertar Items de Venta y Descontar Stock
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

    -- Descontar inventario
    UPDATE public.products 
    SET stock = GREATEST(0, COALESCE(stock, 0) - v_quantity),
        updated_at = NOW()
    WHERE id = v_product_id;

    -- Descontar ingredientes si aplica
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

-- Permisos y recarga de caché en Supabase
GRANT EXECUTE ON FUNCTION public.create_sale_transaction_v3(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
