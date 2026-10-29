-- Migración para el Flujo de Aprobación de Recargas de Billetera Digital
-- Cuentas Bancarias de CobroApp -> Envío de Comprobante -> Aprobación Administrativa -> Acreditación Automática

-- 1. Tabla de Solicitudes de Recarga de Saldo
CREATE TABLE IF NOT EXISTS public.digital_services_topup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 500 AND amount <= 20000),
    bank_name TEXT NOT NULL,
    reference_number TEXT NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    rejection_reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas en el panel administrativo y POS
CREATE INDEX IF NOT EXISTS idx_digital_topup_store ON public.digital_services_topup_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_digital_topup_status ON public.digital_services_topup_requests(status);
CREATE INDEX IF NOT EXISTS idx_digital_topup_created_at ON public.digital_services_topup_requests(created_at DESC);

-- 2. Habilitar RLS
ALTER TABLE public.digital_services_topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their store topup requests" ON public.digital_services_topup_requests;
CREATE POLICY "Users can view their store topup requests"
    ON public.digital_services_topup_requests
    FOR SELECT
    TO authenticated
    USING (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "Users can create their store topup requests" ON public.digital_services_topup_requests;
CREATE POLICY "Users can create their store topup requests"
    ON public.digital_services_topup_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "Admins can update topup requests" ON public.digital_services_topup_requests;
CREATE POLICY "Admins can update topup requests"
    ON public.digital_services_topup_requests
    FOR UPDATE
    TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- 3. Storage Bucket para Comprobantes de Recarga
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Users and Admins can view payment proofs" ON storage.objects;
CREATE POLICY "Users and Admins can view payment proofs"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment-proofs'
        AND (auth.uid() = owner OR public.is_platform_admin())
    );

-- 4. RPC: Crear Solicitud de Recarga de Billetera
CREATE OR REPLACE FUNCTION public.submit_digital_service_topup(
    p_store_id UUID,
    p_amount NUMERIC(12,2),
    p_bank_name TEXT,
    p_reference_number TEXT,
    p_receipt_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_id UUID;
BEGIN
    IF p_amount < 500 OR p_amount > 20000 THEN
        RAISE EXCEPTION 'El monto debe estar entre RD$ 500 y RD$ 20,000';
    END IF;

    IF p_bank_name IS NULL OR length(trim(p_bank_name)) = 0 THEN
        RAISE EXCEPTION 'Debe seleccionar el banco de la transferencia';
    END IF;

    IF p_reference_number IS NULL OR length(trim(p_reference_number)) = 0 THEN
        RAISE EXCEPTION 'Debe ingresar el número de referencia del comprobante';
    END IF;

    INSERT INTO public.digital_services_topup_requests (
        store_id,
        user_id,
        amount,
        bank_name,
        reference_number,
        receipt_url,
        notes,
        status
    ) VALUES (
        p_store_id,
        v_user_id,
        p_amount,
        trim(p_bank_name),
        trim(p_reference_number),
        p_receipt_url,
        p_notes,
        'pending'
    ) RETURNING id INTO v_req_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'message', 'Solicitud de recarga registrada exitosamente. Pendiente de aprobación.'
    );
END;
$$;

-- 5. RPC: Aprobar Solicitud de Recarga (Solo Admins de CobroApp)
CREATE OR REPLACE FUNCTION public.approve_digital_service_topup(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
    v_wallet RECORD;
    v_before NUMERIC(12,2) := 0.00;
    v_after NUMERIC(12,2) := 0.00;
BEGIN
    -- Validar que el usuario sea SuperAdmin / Platform Admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores de CobroApp pueden aprobar recargas.';
    END IF;

    -- Bloquear y verificar solicitud
    SELECT * INTO v_req
    FROM public.digital_services_topup_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de recarga no encontrada';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'La solicitud ya ha sido procesada previamente (Estado: %)', v_req.status;
    END IF;

    -- Bloquear y actualizar billetera de la tienda
    SELECT * INTO v_wallet
    FROM public.digital_services_wallets
    WHERE store_id = v_req.store_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.digital_services_wallets (store_id, balance, is_active)
        VALUES (v_req.store_id, v_req.amount, true)
        RETURNING * INTO v_wallet;
        v_before := 0.00;
        v_after := v_req.amount;
    ELSE
        v_before := v_wallet.balance;
        v_after := v_before + v_req.amount;
        UPDATE public.digital_services_wallets
        SET balance = v_after,
            updated_at = now()
        WHERE store_id = v_req.store_id;
    END IF;

    -- Registrar movimiento en la auditoría
    INSERT INTO public.digital_services_wallet_movements (
        store_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_id,
        created_by
    ) VALUES (
        v_req.store_id,
        'deposit',
        v_req.amount,
        v_before,
        v_after,
        'Depósito aprobado: ' || v_req.bank_name || ' (Ref: ' || v_req.reference_number || ')',
        v_req.reference_number,
        auth.uid()
    );

    -- Actualizar estado de la solicitud
    UPDATE public.digital_services_topup_requests
    SET status = 'approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'store_id', v_req.store_id,
        'amount', v_req.amount,
        'new_balance', v_after,
        'message', 'Recarga aprobada y saldo acreditado con éxito'
    );
END;
$$;

-- 6. RPC: Rechazar Solicitud de Recarga (Solo Admins de CobroApp)
CREATE OR REPLACE FUNCTION public.reject_digital_service_topup(
    p_request_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores de CobroApp pueden rechazar recargas.';
    END IF;

    SELECT * INTO v_req
    FROM public.digital_services_topup_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud de recarga no encontrada';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'La solicitud ya ha sido procesada previamente (Estado: %)', v_req.status;
    END IF;

    UPDATE public.digital_services_topup_requests
    SET status = 'rejected',
        rejection_reason = p_reason,
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'message', 'Solicitud rechazada'
    );
END;
$$;
