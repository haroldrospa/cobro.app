-- ==============================================================================
-- MIGRACIÓN: MÓDULO DE SERVICIOS DIGITALES & RECARGAMEYA
-- Módulo independiente para venta de recargas, paqueticos, facturas y luz prepago.
-- Totalmente aislado de ventas normales para no alterar la contabilidad de inventario.
-- ==============================================================================

-- 1. Tabla de Configuración Global de la Plataforma para Servicios Digitales
CREATE TABLE IF NOT EXISTS public.digital_services_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' o 'production'
    api_base_url TEXT NOT NULL DEFAULT 'https://recargameya.com/api/v1/public',
    default_recharge_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 6.00, -- 6% ganancia comercio
    default_bill_fixed_commission NUMERIC(10,2) NOT NULL DEFAULT 15.00, -- RD$ 15 por factura
    deposit_bank_details TEXT DEFAULT 'Banco BHD: 1234567890 | Banco Popular: 9876543210 | A nombre de: CobroApp SRL',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS en digital_services_config
ALTER TABLE public.digital_services_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view digital services config" ON public.digital_services_config;
CREATE POLICY "Anyone authenticated can view digital services config"
    ON public.digital_services_config
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can update digital services config" ON public.digital_services_config;
CREATE POLICY "Admins can update digital services config"
    ON public.digital_services_config
    FOR ALL
    TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- Insertar configuración inicial por defecto si no existe
INSERT INTO public.digital_services_config (api_environment, api_base_url, default_recharge_commission_rate, default_bill_fixed_commission)
SELECT 'sandbox', 'https://recargameya.com/api/v1/public', 6.00, 15.00
WHERE NOT EXISTS (SELECT 1 FROM public.digital_services_config);


-- 2. Tabla de Billetera (Wallet) de la Tienda
CREATE TABLE IF NOT EXISTS public.digital_services_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_sold NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_commission NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    custom_commission_rate NUMERIC(5,2) DEFAULT NULL, -- Si es null usa el default_recharge_commission_rate
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_services_wallets_store_id ON public.digital_services_wallets(store_id);

ALTER TABLE public.digital_services_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own store wallet" ON public.digital_services_wallets;
CREATE POLICY "Users can view their own store wallet"
    ON public.digital_services_wallets
    FOR SELECT
    TO authenticated
    USING (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "Platform admins can manage all wallets" ON public.digital_services_wallets;
CREATE POLICY "Platform admins can manage all wallets"
    ON public.digital_services_wallets
    FOR ALL
    TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());


-- 3. Tabla de Transacciones de Servicios Digitales
CREATE TABLE IF NOT EXISTS public.digital_services_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL DEFAULT 'recharge', -- 'recharge', 'data_package', 'bill_payment', 'prepaid_power', 'remittance'
    carrier TEXT NOT NULL,                         -- 'claro', 'altice', 'viva', 'edeeste', 'edesur', 'edenorte', 'caasd', etc.
    target_number TEXT NOT NULL,                   -- Teléfono, Contrato, NIC o Medidor
    target_name TEXT,                              -- Nombre del cliente o abonado (en facturas)
    amount NUMERIC(12,2) NOT NULL,                 -- Monto nominal cobrado al cliente (ej. 100)
    amount_charged NUMERIC(12,2) NOT NULL,         -- Costo deducido de la plataforma (ej. 94)
    commission NUMERIC(12,2) NOT NULL DEFAULT 0.00,-- Ganancia neta retenida por el comercio (ej. 6)
    client_reference_id TEXT NOT NULL UNIQUE,     -- UUID / REF para idempotencia estricta
    external_id TEXT,                              -- ID devuelto por RecargameYa (TXN-...)
    status TEXT NOT NULL DEFAULT 'completed',      -- 'completed', 'pending', 'failed', 'refunded'
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_services_tx_store_id ON public.digital_services_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_digital_services_tx_created_at ON public.digital_services_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_services_tx_reference ON public.digital_services_transactions(client_reference_id);
CREATE INDEX IF NOT EXISTS idx_digital_services_tx_carrier ON public.digital_services_transactions(carrier);

ALTER TABLE public.digital_services_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their store digital transactions" ON public.digital_services_transactions;
CREATE POLICY "Users can view their store digital transactions"
    ON public.digital_services_transactions
    FOR SELECT
    TO authenticated
    USING (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "Users can insert their store digital transactions" ON public.digital_services_transactions;
CREATE POLICY "Users can insert their store digital transactions"
    ON public.digital_services_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );


-- 4. Tabla de Movimientos de Saldo de la Billetera (Auditoría)
CREATE TABLE IF NOT EXISTS public.digital_services_wallet_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'deposit', 'service_sale', 'refund', 'adjustment'
    amount NUMERIC(12,2) NOT NULL, -- Positivo si entra saldo, negativo si sale
    balance_before NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    description TEXT,
    reference_id TEXT, -- Puede apuntar al client_reference_id de la venta o al número de depósito
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_services_mov_store_id ON public.digital_services_wallet_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_digital_services_mov_created_at ON public.digital_services_wallet_movements(created_at DESC);

ALTER TABLE public.digital_services_wallet_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their store wallet movements" ON public.digital_services_wallet_movements;
CREATE POLICY "Users can view their store wallet movements"
    ON public.digital_services_wallet_movements
    FOR SELECT
    TO authenticated
    USING (
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
        OR public.is_platform_admin()
    );


-- 5. Funciones RPC Atómicas para Operación Segura y Concurrente

-- 5.1 Obtener o crear billetera de la tienda
CREATE OR REPLACE FUNCTION public.get_or_create_store_wallet(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
BEGIN
    SELECT * INTO v_wallet
    FROM public.digital_services_wallets
    WHERE store_id = p_store_id;

    IF NOT FOUND THEN
        INSERT INTO public.digital_services_wallets (store_id, balance, is_active)
        VALUES (p_store_id, 0.00, true)
        RETURNING * INTO v_wallet;
    END IF;

    RETURN to_jsonb(v_wallet);
END;
$$;

-- 5.2 Recargar saldo a la billetera de una tienda (Para el Administrador o tras validar pago)
CREATE OR REPLACE FUNCTION public.add_store_digital_balance(
    p_store_id UUID,
    p_amount NUMERIC(12,2),
    p_description TEXT DEFAULT 'Recarga de saldo a billetera',
    p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_before NUMERIC(12,2);
    v_after NUMERIC(12,2);
    v_user_id UUID := auth.uid();
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto a recargar debe ser mayor a cero';
    END IF;

    -- Bloqueo de fila para evitar race conditions
    SELECT * INTO v_wallet
    FROM public.digital_services_wallets
    WHERE store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.digital_services_wallets (store_id, balance)
        VALUES (p_store_id, 0.00)
        RETURNING * INTO v_wallet;
    END IF;

    v_before := v_wallet.balance;
    v_after := v_before + p_amount;

    UPDATE public.digital_services_wallets
    SET balance = v_after,
        updated_at = now()
    WHERE store_id = p_store_id;

    -- Registrar movimiento en auditoría
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
        p_store_id,
        'deposit',
        p_amount,
        v_before,
        v_after,
        p_description,
        p_reference,
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'previous_balance', v_before,
        'new_balance', v_after,
        'recharged_amount', p_amount
    );
END;
$$;

-- 5.3 Procesar venta atómica de servicio digital
CREATE OR REPLACE FUNCTION public.record_digital_service_sale(
    p_store_id UUID,
    p_service_type TEXT,
    p_carrier TEXT,
    p_target_number TEXT,
    p_target_name TEXT,
    p_amount NUMERIC(12,2),
    p_amount_charged NUMERIC(12,2),
    p_commission NUMERIC(12,2),
    p_client_reference_id TEXT,
    p_external_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_before NUMERIC(12,2);
    v_after NUMERIC(12,2);
    v_tx_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validar que no exista la referencia para asegurar idempotencia
    IF EXISTS (SELECT 1 FROM public.digital_services_transactions WHERE client_reference_id = p_client_reference_id) THEN
        SELECT id INTO v_tx_id FROM public.digital_services_transactions WHERE client_reference_id = p_client_reference_id;
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'transaction_id', v_tx_id,
            'message', 'Transacción ya procesada previamente (idempotente)'
        );
    END IF;

    -- Bloqueo de fila para restar el balance de costo
    SELECT * INTO v_wallet
    FROM public.digital_services_wallets
    WHERE store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La billetera de servicios para este comercio no existe.';
    END IF;

    IF NOT v_wallet.is_active THEN
        RAISE EXCEPTION 'La billetera de servicios digitales se encuentra inactiva.';
    END IF;

    -- Verificar fondos disponibles (Balance + Línea de Crédito)
    IF (v_wallet.balance + v_wallet.credit_limit) < p_amount_charged THEN
        RAISE EXCEPTION 'Saldo insuficiente en su billetera de servicios. Saldo actual: RD$ %, Costo: RD$ %', v_wallet.balance, p_amount_charged;
    END IF;

    v_before := v_wallet.balance;
    v_after := v_before - p_amount_charged;

    -- Actualizar billetera
    UPDATE public.digital_services_wallets
    SET balance = v_after,
        total_sold = total_sold + p_amount,
        total_cost = total_cost + p_amount_charged,
        total_commission = total_commission + p_commission,
        updated_at = now()
    WHERE store_id = p_store_id;

    -- Registrar la transacción
    INSERT INTO public.digital_services_transactions (
        store_id,
        user_id,
        service_type,
        carrier,
        target_number,
        target_name,
        amount,
        amount_charged,
        commission,
        client_reference_id,
        external_id,
        status,
        metadata
    ) VALUES (
        p_store_id,
        v_user_id,
        p_service_type,
        p_carrier,
        p_target_number,
        p_target_name,
        p_amount,
        p_amount_charged,
        p_commission,
        p_client_reference_id,
        p_external_id,
        'completed',
        p_metadata
    ) RETURNING id INTO v_tx_id;

    -- Registrar movimiento de egreso por la venta
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
        p_store_id,
        'service_sale',
        -p_amount_charged,
        v_before,
        v_after,
        'Venta ' || p_carrier || ' - ' || p_target_number,
        p_client_reference_id,
        v_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'balance_before', v_before,
        'new_balance', v_after,
        'amount_charged', p_amount_charged,
        'commission', p_commission
    );
END;
$$;
