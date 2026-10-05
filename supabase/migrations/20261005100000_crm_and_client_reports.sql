-- ==============================================================================
-- MIGRACIÓN: CRM DE SEGUIMIENTO Y REPORTES DE CLIENTES
-- ==============================================================================

-- 1. Tabla para notas de seguimiento / llamadas a clientes (CRM)
CREATE TABLE IF NOT EXISTS public.client_follow_up_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL DEFAULT 'call', -- 'call', 'whatsapp', 'email', 'meeting', 'other'
    client_feedback TEXT NOT NULL,             -- Lo que dijo el cliente durante la llamada
    status TEXT NOT NULL DEFAULT 'contacted',  -- 'new', 'called', 'interested', 'trial', 'active', 'unreachable', 'not_interested'
    created_by TEXT,                           -- Email del admin que registró la nota
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_client_follow_up_notes_store_id ON public.client_follow_up_notes(store_id);
CREATE INDEX IF NOT EXISTS idx_client_follow_up_notes_created_at ON public.client_follow_up_notes(created_at DESC);

-- RLS para client_follow_up_notes
ALTER TABLE public.client_follow_up_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage follow-up notes" ON public.client_follow_up_notes;
CREATE POLICY "Admins can manage follow-up notes"
ON public.client_follow_up_notes
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 2. Tabla para reportes de contacto / soporte generados por los clientes
CREATE TABLE IF NOT EXISTS public.client_support_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL DEFAULT 'help_getting_started', -- 'help_getting_started', 'technical_issue', 'billing_question', 'feature_request', 'contact_request', 'other'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
    admin_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Índices para reportes
CREATE INDEX IF NOT EXISTS idx_client_support_reports_store_id ON public.client_support_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_client_support_reports_created_at ON public.client_support_reports(created_at DESC);

-- RLS para client_support_reports
ALTER TABLE public.client_support_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store users can insert reports" ON public.client_support_reports;
CREATE POLICY "Store users can insert reports"
ON public.client_support_reports
FOR INSERT
TO authenticated
WITH CHECK (
    store_id IN (
        SELECT s.id FROM public.stores s WHERE s.owner_id = auth.uid()
        UNION
        SELECT p.store_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "Store users can view own reports" ON public.client_support_reports;
CREATE POLICY "Store users can view own reports"
ON public.client_support_reports
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT s.id FROM public.stores s WHERE s.owner_id = auth.uid()
        UNION
        SELECT p.store_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "SuperAdmins can update reports" ON public.client_support_reports;
CREATE POLICY "SuperAdmins can update reports"
ON public.client_support_reports
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 3. Actualizar función RPC get_all_stores_admin() para incluir datos del CRM y contador de reportes
DROP FUNCTION IF EXISTS public.get_all_stores_admin();

CREATE OR REPLACE FUNCTION public.get_all_stores_admin()
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    store_code TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    owner_email TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    plan_name TEXT,
    plan_end_date TIMESTAMP WITH TIME ZONE,
    plan_status TEXT,
    reports_count BIGINT,
    latest_follow_up_status TEXT,
    latest_follow_up_note TEXT,
    latest_follow_up_date TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Validar permisos de SuperAdmin
    IF NOT public.is_platform_admin() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.store_name,
        s.store_code,
        s.is_active,
        s.created_at,
        p.email as owner_email,
        COALESCE(NULLIF(TRIM(p.full_name), ''), 'Usuario') as owner_name,
        COALESCE(NULLIF(TRIM(p.phone), ''), NULLIF(TRIM(cs_set.phone), ''), '') as owner_phone,
        COALESCE(sub.plan_id, 'basic') as plan_name,
        sub.end_date as plan_end_date,
        sub.status as plan_status,
        (
            COALESCE((SELECT COUNT(*) FROM public.client_support_reports csr WHERE csr.store_id = s.id), 0) +
            COALESCE((SELECT COUNT(*) FROM public.payment_reports pr WHERE pr.company_id = s.id), 0)
        )::BIGINT as reports_count,
        latest_fu.status as latest_follow_up_status,
        latest_fu.client_feedback as latest_follow_up_note,
        latest_fu.created_at as latest_follow_up_date
    FROM public.stores s
    JOIN public.profiles p ON s.owner_id = p.id
    LEFT JOIN public.company_settings cs_set ON cs_set.store_id = s.id
    LEFT JOIN LATERAL (
        SELECT cs.plan_id, cs.status, cs.end_date
        FROM public.company_subscriptions cs
        WHERE cs.company_id = s.id
        ORDER BY cs.created_at DESC
        LIMIT 1
    ) sub ON true
    LEFT JOIN LATERAL (
        SELECT fn.status, fn.client_feedback, fn.created_at
        FROM public.client_follow_up_notes fn
        WHERE fn.store_id = s.id
        ORDER BY fn.created_at DESC
        LIMIT 1
    ) latest_fu ON true
    WHERE 
        -- A. El perfil del usuario debe pertenecer a este mismo comercio (no ser empleado de otra empresa)
        (p.store_id IS NULL OR p.store_id = s.id)
        -- B. No debe tener rol subordinado de empleado en el sistema
        AND (p.role IS NULL OR p.role NOT IN ('cashier', 'staff', 'kitchen', 'delivery', 'accountant'))
        -- C. No debe estar registrado como empleado de otra tienda
        AND NOT EXISTS (
            SELECT 1 FROM public.profiles emp_p
            WHERE emp_p.id = s.owner_id
              AND emp_p.store_id IS NOT NULL 
              AND emp_p.store_id <> s.id
        )
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_stores_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_stores_admin() TO service_role;

-- 4. Actualizar trigger handle_new_user para persistir número de teléfono en profiles y company_settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  company_name_val TEXT;
  new_store_id     UUID;
  new_store_code   TEXT;
  new_slug         TEXT;
  counter          INTEGER;
  new_user_number  TEXT;
  v_plan_id        TEXT;
  v_is_employee    BOOLEAN;
  v_target_store_id UUID;
  v_phone          TEXT;
BEGIN
  -- Verificar si el usuario que se registra es un empleado invitado
  v_is_employee := COALESCE((NEW.raw_user_meta_data ->> 'is_employee')::BOOLEAN, false);
  IF v_is_employee AND NEW.raw_user_meta_data ->> 'store_id' IS NOT NULL THEN
    v_target_store_id := (NEW.raw_user_meta_data ->> 'store_id')::UUID;
  ELSE
    v_target_store_id := NULL;
  END IF;

  -- Número de usuario único
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.profiles
   WHERE user_number LIKE 'USR-%';

  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');
  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'phone'), '');

  -- SI ES EMPLEADO: crear únicamente su perfil y rol, SIN tienda ni suscripción propia
  IF v_is_employee THEN
    INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active, phone)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Empleado'),
      new_user_number,
      v_target_store_id,
      COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'),
      true,
      v_phone
    )
    ON CONFLICT (id) DO UPDATE
      SET store_id = COALESCE(EXCLUDED.store_id, profiles.store_id),
          role = COALESCE(EXCLUDED.role, profiles.role),
          phone = COALESCE(EXCLUDED.phone, profiles.phone);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff'))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  -- SI ES DUEÑO DE COMERCIO: crear tienda, perfil, suscripción y configuraciones habituales
  company_name_val := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), ''),
    'Mi Comercio ' || new_user_number
  );

  v_plan_id := COALESCE(NEW.raw_user_meta_data ->> 'plan_id', 'basic');
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    v_plan_id := 'basic';
  END IF;

  new_store_code := public.generate_store_code();
  new_slug       := public.generate_store_slug(company_name_val, new_store_code);

  IF EXISTS (SELECT 1 FROM public.stores WHERE slug = new_slug) THEN
    new_store_code := public.generate_store_code();
    new_slug       := public.generate_store_slug(company_name_val, new_store_code);
  END IF;

  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Usuario'),
    new_user_number,
    new_store_id,
    'admin',
    true,
    v_phone
  )
  ON CONFLICT (id) DO UPDATE
    SET store_id = new_store_id,
        phone = COALESCE(EXCLUDED.phone, profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.company_subscriptions (
    company_id, plan_id, status, start_date, end_date, payment_method
  )
  VALUES (
    new_store_id, v_plan_id, 'active',
    now(), now() + INTERVAL '15 days',
    'trial'
  );

  INSERT INTO public.company_settings (store_id, company_name, phone)
  VALUES (new_store_id, company_name_val, v_phone)
  ON CONFLICT (store_id) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        phone = COALESCE(EXCLUDED.phone, company_settings.phone);

  INSERT INTO public.store_settings (store_id, shop_type)
  VALUES (new_store_id, COALESCE(NEW.raw_user_meta_data ->> 'shop_type', 'store'))
  ON CONFLICT (store_id) DO UPDATE 
    SET shop_type = EXCLUDED.shop_type;

  INSERT INTO public.categories (name, description, store_id) VALUES
    ('General',  'Productos generales',   new_store_id),
    ('Bebidas',  'Bebidas y líquidos',    new_store_id),
    ('Comida',   'Alimentos preparados',  new_store_id),
    ('Snacks',   'Bocadillos',            new_store_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id)
  VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id),
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user FAILED for user %: SQLSTATE=% MSG=%', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
