-- Enable realtime for company_settings
ALTER TABLE public.company_settings REPLICA IDENTITY FULL;

-- Enable realtime for store_settings
ALTER TABLE public.store_settings REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;