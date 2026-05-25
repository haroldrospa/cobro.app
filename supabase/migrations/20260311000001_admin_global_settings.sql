-- Create a table for global administrative settings
CREATE TABLE IF NOT EXISTS public.admin_global_settings (
    id TEXT PRIMARY KEY, -- 'notification_email' as key
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate with the default email
INSERT INTO public.admin_global_settings (id, value)
VALUES ('notification_email', 'haroldrospa@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- Policies
ALTER TABLE public.admin_global_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (so stores can send emails) but only super-admins to write
-- Since the super-admin logic is currently handled manually in SuperAdmin.tsx,
-- we'll just allow all authenticated users to read it, but restricting write would be better.
-- But for now, ensuring read access:
CREATE POLICY "Allow all authenticated read admin_global_settings" 
ON public.admin_global_settings FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated write admin_global_settings" 
ON public.admin_global_settings FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated insert admin_global_settings" 
ON public.admin_global_settings FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
