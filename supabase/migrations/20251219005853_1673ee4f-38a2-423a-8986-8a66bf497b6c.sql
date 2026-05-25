-- Agregar columna user_number a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_number TEXT UNIQUE;

-- Crear función para generar número de usuario automático
CREATE OR REPLACE FUNCTION public.generate_user_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(user_number FROM 5) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles
  WHERE user_number LIKE 'USR-%';
  
  new_number := 'USR-' || LPAD(counter::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Actualizar función handle_new_user para incluir user_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Crear perfil con número de usuario
  INSERT INTO public.profiles (id, email, full_name, user_number)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    generate_user_number()
  );
  
  -- Asignar rol por defecto (customer)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();