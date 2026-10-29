-- Migración para corregir process_subscription_payment y visualización de comprobantes
-- 1. Asegurar que el bucket payment-proofs sea público para permitir previsualizaciones sin problemas de 403
UPDATE storage.buckets 
SET public = true 
WHERE id = 'payment-proofs';

-- 2. Asegurar políticas de lectura en storage.objects para payment-proofs
DROP POLICY IF EXISTS "Public can view payment proofs" ON storage.objects;
CREATE POLICY "Public can view payment proofs"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'payment-proofs');

-- 3. Corregir función process_subscription_payment
CREATE OR REPLACE FUNCTION public.process_subscription_payment(
    p_report_id UUID,
    p_status TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_report RECORD;
    v_days INTEGER := 30;
    v_target_plan TEXT;
    v_update_res JSONB;
BEGIN
    -- Validar que solo SuperAdmin pueda procesar
    IF NOT public.is_platform_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Acceso denegado: solo SuperAdmin.');
    END IF;

    -- Obtener reporte
    SELECT * INTO v_report FROM public.payment_reports WHERE id = p_report_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Reporte no encontrado');
    END IF;

    -- Actualizar estado del reporte en payment_reports
    UPDATE public.payment_reports 
    SET 
        status = p_status, 
        admin_note = COALESCE(p_admin_note, CASE WHEN p_status = 'approved' THEN 'Aprobado desde panel maestro' ELSE 'Rechazado' END),
        updated_at = now()
    WHERE id = p_report_id;

    -- Si se aprueba, activar o extender la suscripción
    IF p_status = 'approved' THEN
        v_target_plan := COALESCE(v_report.target_plan_id, 'pro');
        
        -- Si el monto es representativo de plan anual (e.g. >= 5000), dar 365 días
        IF COALESCE(v_report.amount, 0) >= 5000 THEN
            v_days := 365;
        ELSE
            v_days := 30;
        END IF;

        -- Actualizar o crear suscripción llamando a admin_update_subscription
        v_update_res := public.admin_update_subscription(v_report.company_id, v_target_plan, v_days);
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', CASE WHEN p_status = 'approved' THEN 'Pago aprobado y suscripción activada' ELSE 'Pago rechazado' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_subscription_payment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_payment(UUID, TEXT, TEXT) TO service_role;
