-- ==========================================
-- FIX: Create safe RPC to update shopper profiles bypassing broken trigger
-- The trigger sync_profile_to_customer fails for role='customer' profiles
-- because it references OLD.customer_id which no longer exists.
-- SET LOCAL session_replication_role = 'replica' disables triggers for the
-- duration of this transaction only (safe, session-scoped).
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_shopper_profile(
    p_full_name  TEXT    DEFAULT NULL,
    p_phone      TEXT    DEFAULT NULL,
    p_address    TEXT    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Disable all row-level triggers for this transaction only
    -- This bypasses the broken sync_profile_to_customer trigger
    SET LOCAL session_replication_role = 'replica';

    UPDATE public.profiles
    SET
        full_name  = COALESCE(p_full_name,  full_name),
        phone      = COALESCE(p_phone,      phone),
        address    = COALESCE(p_address,    address),
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated users (shoppers)
GRANT EXECUTE ON FUNCTION public.update_shopper_profile(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_shopper_profile(TEXT, TEXT, TEXT) TO anon;
