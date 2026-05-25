-- Create invoice sequences table
CREATE TABLE public.invoice_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_type_id text NOT NULL,
  current_number integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(invoice_type_id)
);

-- Enable RLS
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public access to invoice sequences" 
ON public.invoice_sequences 
FOR ALL 
USING (true);

-- Insert default sequences for all invoice types
INSERT INTO public.invoice_sequences (invoice_type_id, current_number) VALUES
('B01', 1),
('B02', 1), 
('B03', 1),
('B14', 1),
('B15', 1),
('B16', 1);

-- Update invoice_types table with the correct codes
INSERT INTO public.invoice_types (id, name, description, code) VALUES
('B01', 'Crédito Fiscal', 'Factura con crédito fiscal', 'B01'),
('B02', 'Consumidor Final', 'Factura para consumidor final', 'B02'),
('B03', 'Nota de Débito', 'Nota de débito', 'B03'),
('B14', 'Regímenes Especiales', 'Factura para regímenes especiales', 'B14'),
('B15', 'Gubernamental', 'Factura gubernamental', 'B15'),
('B16', 'Exportaciones', 'Factura de exportación', 'B16')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  code = EXCLUDED.code;

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(invoice_type_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  formatted_number text;
BEGIN
  -- Get and increment the current number
  UPDATE public.invoice_sequences 
  SET current_number = current_number + 1,
      updated_at = now()
  WHERE invoice_type_id = invoice_type_code
  RETURNING current_number INTO next_number;
  
  -- Format as type + zero-padded number (e.g., B01-001)
  formatted_number := invoice_type_code || '-' || LPAD(next_number::text, 8, '0');
  
  RETURN formatted_number;
END;
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_invoice_sequences_updated_at
BEFORE UPDATE ON public.invoice_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();