-- Migration to handle pending subscription payments
-- Run this in the Supabase SQL Editor

-- Add column for notification email to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS subscription_notification_email TEXT DEFAULT 'Haroldrospa@gmail.com';

-- Create RPC to report payment as PENDING
-- This function only inserts the record, waiting for admin approval
CREATE OR REPLACE FUNCTION public.submit_payment_pending(
    p_company_id UUID,
    p_amount NUMERIC,
    p_currency TEXT,
    p_bank_name TEXT,
    p_proof_url TEXT,
    p_target_plan_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.payment_reports (
        company_id,
        amount,
        currency,
        bank_name,
        proof_url,
        status,
        target_plan_id,
        created_at
    ) VALUES (
        p_company_id,
        p_amount,
        p_currency,
        p_bank_name,
        p_proof_url,
        'pending',
        p_target_plan_id,
        now()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Comprobante enviado. En espera de confirmación.');
END;
$$;
