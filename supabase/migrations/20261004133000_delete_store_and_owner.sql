-- ==============================================================================
-- MIGRACIÓN: ELIMINACIÓN DE TIENDAS Y USUARIOS EN CASCADA (SUPERADMIN)
-- ==============================================================================

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
  -- 1. Validar que el invocador sea SuperAdmin de la plataforma
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Acceso denegado: solo SuperAdmin puede eliminar negocios.');
  END IF;

  -- 2. Verificar si la tienda existe y obtener el dueño
  SELECT EXISTS(SELECT 1 FROM public.stores WHERE id = p_store_id) INTO v_store_exists;
  
  IF NOT v_store_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'La tienda no existe o ya fue eliminada');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = p_store_id;

  -- 3. Eliminar registros de todas las tablas dependientes en orden seguro
  
  -- Nómina y Personal
  BEGIN
    DELETE FROM public.payroll_items WHERE payroll_id IN (SELECT id FROM public.payrolls WHERE store_id = p_store_id);
    DELETE FROM public.payrolls WHERE store_id = p_store_id;
    DELETE FROM public.employees WHERE store_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Facturación y Ventas
  BEGIN
    DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE store_id = p_store_id);
    DELETE FROM public.sales WHERE store_id = p_store_id;
    DELETE FROM public.invoice_sequences WHERE store_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Finanzas, Cajas y Movimientos
  BEGIN
    DELETE FROM public.cash_movements WHERE store_id = p_store_id;
    DELETE FROM public.cash_sessions WHERE store_id = p_store_id;
    DELETE FROM public.daily_closings WHERE store_id = p_store_id;
    DELETE FROM public.payment_reports WHERE company_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Compras, Proveedores y Gastos
  BEGIN
    DELETE FROM public.supplier_debts WHERE store_id = p_store_id;
    DELETE FROM public.suppliers WHERE store_id = p_store_id;
    DELETE FROM public.fixed_expenses WHERE store_id = p_store_id;
    DELETE FROM public.expenses WHERE store_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Clientes y Ofertas
  BEGIN
    DELETE FROM public.customers WHERE store_id = p_store_id;
    DELETE FROM public.product_offers WHERE store_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  
  -- Inventarios y Productos
  BEGIN
    DELETE FROM public.inventory_movements WHERE store_id = p_store_id;
    DELETE FROM public.saved_carts WHERE store_id = p_store_id;
    DELETE FROM public.pos_quick_notes WHERE store_id = p_store_id;
    DELETE FROM public.products WHERE store_id = p_store_id;
    DELETE FROM public.categories WHERE store_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Mensajes y Configuración
  BEGIN
    DELETE FROM public.chat_messages WHERE store_id = p_store_id;
    DELETE FROM public.alanube_config WHERE store_id = p_store_id;
    DELETE FROM public.store_settings WHERE store_id = p_store_id;
    DELETE FROM public.company_settings WHERE store_id = p_store_id;
    DELETE FROM public.company_subscriptions WHERE company_id = p_store_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 4. Eliminar la tienda de public.stores
  DELETE FROM public.stores WHERE id = p_store_id;

  -- 5. Eliminar perfil, roles y cuenta de auth.users si existe dueño
  IF v_owner_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.user_roles WHERE user_id = v_owner_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
      DELETE FROM public.profiles WHERE id = v_owner_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
      DELETE FROM auth.users WHERE id = v_owner_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'La tienda y todos sus datos han sido eliminados de forma permanente.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Error al eliminar la tienda: ' || SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_store_and_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_store_and_owner(UUID) TO service_role;

COMMENT ON FUNCTION public.delete_store_and_owner(UUID) IS 
'Elimina una tienda y todos sus registros transaccionales, inventarios, configuraciones y cuenta de Auth en cascada de forma segura.';

-- Recargar la caché de esquemas de PostgREST inmediatamente
NOTIFY pgrst, 'reload schema';
