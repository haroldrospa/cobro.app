-- Tabla para carritos guardados por usuario/tienda
CREATE TABLE public.saved_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  cart_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(store_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cart
CREATE POLICY "Users can view their own cart"
ON public.saved_carts
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own cart"
ON public.saved_carts
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own cart"
ON public.saved_carts
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own cart"
ON public.saved_carts
FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_saved_carts_updated_at
BEFORE UPDATE ON public.saved_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();