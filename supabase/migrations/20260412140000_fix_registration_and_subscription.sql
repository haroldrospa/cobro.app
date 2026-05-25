-- ==========================================
-- FIX REGISTRATION AND SUBSCRIPTION INITIALIZATION
-- ==========================================

-- 1. LIMPIEZA DE DATOS Y CORRECCIÓN DE RESTRICCIÓN
-- Primero, eliminamos la restricción vieja si existe para que no bloquee la actualización
ALTER TABLE public.company_subscriptions DROP CONSTRAINT IF EXISTS company_subscriptions_payment_method_check;

-- Limpiamos cualquier valor que pueda romper la nueva restricción (mapeamos a 'other' lo desconocido)
-- Esto evita el error "check constraint is violated by some row"
UPDATE public.company_subscriptions 
SET payment_method = 'other' 
WHERE payment_method NOT IN ('transfer', 'paypal', 'cash', 'other', 'trial', 'card', 'pending') 
   OR payment_method IS NULL;

-- Aplicamos la nueva restricción más permisiva que incluye 'trial', 'card' y 'pending'
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_payment_method_check 
CHECK (payment_method IN ('transfer', 'paypal', 'cash', 'other', 'trial', 'card', 'pending'));

-- 2. ASEGURAR FUNCIONES COMPLEMENTARIAS
CREATE OR REPLACE FUNCTION public.generate_store_code()
RETURNS text AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_store_slug(company_name text, store_code text)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
BEGIN
  base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  final_slug := base_slug || '-' || lower(store_code);
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 3. REINICIAR TRIGGER handle_new_user (VERSIÓN COMPLETA Y ROBUSTA)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_store_id UUID;
  new_user_number TEXT;
  new_store_code TEXT;
  new_slug TEXT;
  company_name_val TEXT;
  v_plan_id TEXT;
  counter INTEGER;
BEGIN
  -- A. Generar número de usuario
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_user_number := 'USR-' || LPAD(counter::TEXT, 6, '0');

  -- B. Extraer datos de la metadata
  company_name_val := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Mi Comercio ' || new_user_number);
  v_plan_id := COALESCE(NEW.raw_user_meta_data ->> 'plan_id', 'basic');

  -- C. Generar códigos de tienda
  new_store_code := generate_store_code();
  new_slug := generate_store_slug(company_name_val, new_store_code);

  -- D. Crear Tienda
  INSERT INTO public.stores (store_name, store_code, slug, owner_id, is_active)
  VALUES (company_name_val, new_store_code, new_slug, NEW.id, true)
  RETURNING id INTO new_store_id;

  -- E. Crear Perfil Principal (Admin/Owner)
  INSERT INTO public.profiles (id, email, full_name, user_number, store_id, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    new_user_number,
    new_store_id,
    'admin',
    true
  );
  
  -- F. Asignar rol en tabla de roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  -- G. Crear Suscripción Inicial (SOPORTE PARA TRIAL)
  INSERT INTO public.company_subscriptions (
      company_id, 
      plan_id, 
      status, 
      start_date, 
      end_date,
      payment_method
  )
  VALUES (
      new_store_id, 
      v_plan_id, 
      'active', 
      now(), 
      now() + INTERVAL '14 days', 
      'trial'
  );

  -- H. Inicializar Configuraciones del Negocio
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name_val);

  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id);

  -- I. Inicializar Categorías por Defecto
  INSERT INTO public.categories (name, description, store_id) VALUES
    ('Bebidas', 'Bebidas y líquidos', new_store_id),
    ('Comida', 'Alimentos preparados', new_store_id),
    ('Snacks', 'Bocadillos', new_store_id);

  -- J. Inicializar Secuencias de Facturación
  INSERT INTO public.invoice_sequences (invoice_type_id, current_number, store_id) VALUES
    ('B01', 0, new_store_id),
    ('B02', 0, new_store_id), 
    ('B03', 0, new_store_id),
    ('B14', 0, new_store_id),
    ('B15', 0, new_store_id),
    ('B16', 0, new_store_id);
    
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- 4. RECREAR EL TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
