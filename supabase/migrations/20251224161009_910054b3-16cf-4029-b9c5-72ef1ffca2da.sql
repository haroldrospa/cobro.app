-- Create a comprehensive store_settings table for all configuration settings
CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Invoice Settings
  invoice_prefix text DEFAULT 'FAC-',
  auto_increment boolean DEFAULT true,
  show_tax boolean DEFAULT true,
  default_tax_rate numeric DEFAULT 18,
  currency text DEFAULT 'DOP',
  payment_terms integer DEFAULT 30,
  invoice_footer_text text DEFAULT 'Gracias por su preferencia',
  
  -- Payment Settings (JSON for flexibility with payment methods)
  payment_methods jsonb DEFAULT '[
    {"id": "cash", "name": "Efectivo", "enabled": true},
    {"id": "card", "name": "Tarjeta", "enabled": true},
    {"id": "transfer", "name": "Transferencia", "enabled": true},
    {"id": "check", "name": "Cheque", "enabled": false},
    {"id": "credit", "name": "Crédito", "enabled": true}
  ]'::jsonb,
  
  -- Product Settings
  low_stock_alert boolean DEFAULT true,
  low_stock_threshold integer DEFAULT 10,
  
  -- System Settings
  notifications_enabled boolean DEFAULT true,
  auto_backup boolean DEFAULT true,
  theme text DEFAULT 'dark',
  language text DEFAULT 'es',
  timezone text DEFAULT 'America/Santo_Domingo',
  
  -- Print Settings
  paper_size text DEFAULT '80mm',
  use_thermal_printer boolean DEFAULT false,
  thermal_printer_name text,
  
  -- Advanced Settings
  backup_frequency text DEFAULT 'daily',
  log_retention_days integer DEFAULT 30,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Store owners can view their settings" 
ON public.store_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_settings.store_id 
    AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners can insert their settings" 
ON public.store_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_settings.store_id 
    AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners can update their settings" 
ON public.store_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_settings.store_id 
    AND stores.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view settings" 
ON public.store_settings 
FOR SELECT 
USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff can modify settings" 
ON public.store_settings 
FOR ALL 
USING (is_staff_or_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update create_store_for_user function to also create store_settings
CREATE OR REPLACE FUNCTION public.create_store_for_user(user_id uuid, company_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_store_code text;
  new_slug text;
  new_store_id uuid;
BEGIN
  -- Generate unique store code
  new_store_code := generate_store_code();
  
  -- Generate slug
  new_slug := generate_store_slug(company_name, new_store_code);
  
  -- Create the store
  INSERT INTO public.stores (owner_id, store_code, store_name, slug)
  VALUES (user_id, new_store_code, company_name, new_slug)
  RETURNING id INTO new_store_id;
  
  -- Update user profile with store_id
  UPDATE public.profiles
  SET store_id = new_store_id
  WHERE id = user_id;
  
  -- Create default company settings for the store
  INSERT INTO public.company_settings (store_id, company_name)
  VALUES (new_store_id, company_name);
  
  -- Create default store settings
  INSERT INTO public.store_settings (store_id)
  VALUES (new_store_id);
  
  RETURN new_store_id;
END;
$$;