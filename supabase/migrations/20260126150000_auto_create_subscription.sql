-- Trigger que se ejecuta al crearse un usuario (profile)
-- Debemos asegurarnos de que la metadata incluya el plan_id

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_store_id UUID;
    v_plan_id TEXT;
    v_days_duration INTEGER := 30; -- 30 días por defecto
BEGIN
    -- 1. Obtener la tienda que se acaba de crear para este usuario
    -- (Asumiendo que stores.owner_id ya se insertó o se está insertando)
    -- NOTA: Esto depende de cómo tengas tu trigger de creación de Stores.
    -- Si 'stores' se crea AFTER INSERT ON profiles, entonces este trigger debe ser AFTER INSERT tambien.
    
    -- Obtenemos el plan seleccionado de la metadata del usuario
    v_plan_id := new.raw_user_meta_data->>'plan_id';
    
    -- Si no seleccionó plan, asignamos 'basic' por defecto
    IF v_plan_id IS NULL THEN
        v_plan_id := 'basic';
    END IF;

    -- Buscamos la tienda del usuario
    -- IMPORTANTE: Aquí hay un problema de "Race Condition". 
    -- Si el perfil se crea antes que la tienda, no encontraremos la tienda aun.
    -- Lo ideal: Manejar esto en la función que crea la tienda (create_store_for_user).
    
    RETURN NEW;
END;
$$;

-- MEJOR ENFOQUE:
-- Modificar la función que crea la tienda para que lea la metadata y cree la suscripción.
-- Supongo que tienes un trigger 'on_auth_user_created' que inserta en 'profiles' y 'stores'.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_store_id UUID;
    v_plan_id TEXT;
BEGIN
    -- 1. Insertar perfil
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'admin');

    -- 2. Crear Tienda
    INSERT INTO public.stores (owner_id, store_name, store_code)
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'company_name',
        'BP-' || substr(md5(random()::text), 1, 6) -- Generar codigo simple temporal
    )
    RETURNING id INTO v_store_id;

    -- 3. Crear Suscripción Inicial
    v_plan_id := new.raw_user_meta_data->>'plan_id';
    IF v_plan_id IS NULL THEN v_plan_id := 'basic'; END IF;

    -- Estado 'active' temporalmente para que prueben (Trial) o 'pending_payment'
    INSERT INTO public.company_subscriptions (
        company_id, 
        plan_id, 
        status, 
        start_date, 
        end_date,
        payment_method
    )
    VALUES (
        v_store_id, 
        v_plan_id, 
        'active', -- Les damos acceso inmediato (Trial Mode) o 'pending'
        now(), 
        now() + INTERVAL '14 days', -- 14 días de prueba gratis
        'trial'
    );

    -- Actualizar store_id en profile
    UPDATE public.profiles SET store_id = v_store_id WHERE id = new.id;

    RETURN new;
END;
$$;
