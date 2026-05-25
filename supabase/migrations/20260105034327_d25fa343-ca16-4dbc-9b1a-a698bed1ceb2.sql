-- Create promotional banners table
CREATE TABLE public.promotional_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotional_banners ENABLE ROW LEVEL SECURITY;

-- Policies for store owners
CREATE POLICY "Store owners can manage their banners"
ON public.promotional_banners
FOR ALL
USING (owns_store(store_id, auth.uid()))
WITH CHECK (owns_store(store_id, auth.uid()));

-- Public read policy for active banners
CREATE POLICY "Anyone can view active banners"
ON public.promotional_banners
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_promotional_banners_updated_at
BEFORE UPDATE ON public.promotional_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();