-- Crear tabla de configuracion de Alanube
CREATE TABLE IF NOT EXISTS public.alanube_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  api_token TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  base_url TEXT NOT NULL DEFAULT 'https://api.alanube.co',
  rnc_emisor TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id)
);

-- Habilitar RLS en alanube_config
ALTER TABLE public.alanube_config ENABLE ROW LEVEL SECURITY;

-- Politicas para alanube_config
CREATE POLICY "Users can view alanube config for their stores" ON public.alanube_config
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid() OR id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert alanube config for their stores" ON public.alanube_config
  FOR INSERT WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid() OR id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update alanube config for their stores" ON public.alanube_config
  FOR UPDATE USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid() OR id IN (
        SELECT store_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Modificar tabla sales (Factura)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_electronic BOOLEAN DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS encf TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS codigo_seguridad TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS fecha_firma TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS qrcode_url TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS alanube_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS estado_fiscal TEXT CHECK (estado_fiscal IN ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ERROR_CONEXION'));
