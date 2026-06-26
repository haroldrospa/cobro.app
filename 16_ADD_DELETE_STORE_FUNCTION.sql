-- ============================================================================
-- SCRIPT DE MIGRACIÓN: ELIMINACIÓN DE TIENDAS Y USUARIOS EN CASCADA
-- Ejecuta este script en el editor SQL de Supabase para crear la función RPC.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_store_and_owner(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id UUID;
  v_store_exists BOOLEAN;
BEGIN
  -- 1. Verificar si la tienda existe y obtener el dueño
  SELECT EXISTS(SELECT 1 FROM public.stores WHERE id = p_store_id) INTO v_store_exists;
  
  IF NOT v_store_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'La tienda no existe o ya fue eliminada');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;

  -- 2. Eliminar registros de todas las tablas dependientes en el orden correcto
  -- (De secundarias a principales para evitar violaciones de foreign keys)
  
  -- Nómina y Personal
  DELETE FROM public.payroll_items WHERE payroll_id IN (SELECT id FROM public.payrolls WHERE store_id = p_store_id);
  DELETE FROM public.payrolls WHERE store_id = p_store_id;
  DELETE FROM public.employees WHERE store_id = p_store_id;

  -- Facturación y Ventas
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE store_id = p_store_id);
  DELETE FROM public.sales WHERE store_id = p_store_id;
  DELETE FROM public.invoice_sequences WHERE store_id = p_store_id;

  -- Finanzas, Cajas y Movimientos
  DELETE FROM public.cash_movements WHERE store_id = p_store_id;
  DELETE FROM public.cash_sessions WHERE store_id = p_store_id;
  DELETE FROM public.daily_closings WHERE store_id = p_store_id;
  DELETE FROM public.payment_reports WHERE company_id = p_store_id;

  -- Compras, Proveedores y Gastos
  DELETE FROM public.supplier_debts WHERE store_id = p_store_id;
  DELETE FROM public.suppliers WHERE store_id = p_store_id;
  DELETE FROM public.fixed_expenses WHERE store_id = p_store_id;
  DELETE FROM public.expenses WHERE store_id = p_store_id;

  -- Clientes y Ofertas
  DELETE FROM public.customers WHERE store_id = p_store_id;
  DELETE FROM public.product_offers WHERE store_id = p_store_id;
  
  -- Inventarios y Productos
  DELETE FROM public.inventory_movements WHERE store_id = p_store_id;
  DELETE FROM public.products WHERE store_id = p_store_id;
  DELETE FROM public.categories WHERE store_id = p_store_id;

  -- Configuraciones y Suscripciones de la tienda
  DELETE FROM public.store_settings WHERE store_id = p_store_id;
  DELETE FROM public.company_settings WHERE store_id = p_store_id;
  DELETE FROM public.company_subscriptions WHERE company_id = p_store_id;

  -- 3. Eliminar la tienda de public.stores
  DELETE FROM public.stores WHERE id = p_store_id;

  -- 4. Eliminar el perfil, roles y cuenta de usuario en auth.users
  IF v_owner_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_owner_id;
    DELETE FROM public.profiles WHERE id = v_owner_id;
    DELETE FROM auth.users WHERE id = v_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'La tienda y su usuario dueño han sido eliminados de forma permanente de la base de datos'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Error en la base de datos durante la eliminación: ' || SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.delete_store_and_owner IS 'Deletes a store and all associated transactional data, settings, profile, and Auth account';
