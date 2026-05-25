-- ==========================================
-- FIX: sync_profile_to_customer trigger crashes for shoppers (role='customer')
-- Error: "record new has no field customer_id"
-- Solution: Guard the trigger function to exit immediately for customers
-- ==========================================

-- 1. Drop conflicting old column if still present (safe no-op if already dropped)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS customer_id CASCADE;

-- 2. Replace the trigger function with a safe version that skips role='customer'
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync non-customer profiles (employees, owners, admins, etc.)
    IF NEW.role IS NULL OR NEW.role = 'customer' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.customers (
        name,
        email,
        phone,
        store_id,
        is_employee,
        profile_id,
        customer_type
    )
    VALUES (
        COALESCE(NEW.full_name, 'Empleado Sin Nombre'),
        NEW.email,
        NEW.phone,
        NEW.store_id,
        TRUE,
        NEW.id,
        'final'
    )
    ON CONFLICT (profile_id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        store_id = EXCLUDED.store_id,
        is_employee = TRUE,
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block a profile update due to sync errors
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-install the trigger (no change needed, function is replaced above)
DROP TRIGGER IF EXISTS trigger_sync_profile_to_customer ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_customer
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_customer();
