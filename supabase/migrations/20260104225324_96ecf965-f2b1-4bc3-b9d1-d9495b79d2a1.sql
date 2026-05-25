-- Add email report settings to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS email_reports_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_reports_frequency text DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS email_reports_recipient text,
ADD COLUMN IF NOT EXISTS email_reports_last_sent timestamp with time zone;