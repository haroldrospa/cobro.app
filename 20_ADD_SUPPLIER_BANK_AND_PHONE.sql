-- Migración: Agregar campos bancarios, teléfono y método de pago a la tabla de proveedores
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'transfer',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT;
