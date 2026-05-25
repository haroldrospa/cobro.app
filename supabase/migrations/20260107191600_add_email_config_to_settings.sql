-- Migration: Add email configuration fields to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS email_greeting TEXT DEFAULT '¡Hola!',
ADD COLUMN IF NOT EXISTS email_message TEXT DEFAULT 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.';

-- Update existing rows with defaults if they are null
UPDATE public.store_settings 
SET 
  email_greeting = COALESCE(email_greeting, '¡Hola!'),
  email_message = COALESCE(email_message, 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.')
WHERE email_greeting IS NULL OR email_message IS NULL;
