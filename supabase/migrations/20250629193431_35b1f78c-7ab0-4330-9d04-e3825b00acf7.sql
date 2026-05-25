
-- Crear tabla de categorías
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla de productos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES public.categories(id),
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'low_stock')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla de clientes
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rnc TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  customer_type TEXT DEFAULT 'final' CHECK (customer_type IN ('final', 'business')),
  credit_limit DECIMAL(10,2) DEFAULT 0,
  credit_used DECIMAL(10,2) DEFAULT 0,
  total_purchases DECIMAL(10,2) DEFAULT 0,
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla de tipos de factura
CREATE TABLE public.invoice_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL
);

-- Crear tabla de ventas/facturas
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  invoice_type_id TEXT REFERENCES public.invoice_types(id),
  subtotal DECIMAL(10,2) NOT NULL,
  discount_total DECIMAL(10,2) DEFAULT 0,
  tax_total DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'credit')),
  amount_received DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla de items de venta
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertar datos iniciales de categorías
INSERT INTO public.categories (name, description) VALUES
  ('Bebidas', 'Bebidas y líquidos diversos'),
  ('Panadería', 'Productos de panadería y repostería'),
  ('Lácteos', 'Productos lácteos y derivados'),
  ('Snacks', 'Bocadillos y aperitivos'),
  ('Abarrotes', 'Productos básicos del hogar');

-- Insertar tipos de factura
INSERT INTO public.invoice_types (id, name, description, code) VALUES
  ('b01', 'Consumo', 'Consumidor final', 'B01'),
  ('b02', 'Crédito Fiscal', 'Con derecho a crédito fiscal', 'B02'),
  ('b03', 'Gubernamental', 'Comprobante gubernamental', 'B03'),
  ('b14', 'Regímenes Especiales', 'Regímenes especiales', 'B14'),
  ('b15', 'Gubernamental', 'Comprobante gubernamental', 'B15'),
  ('b16', 'Exportación', 'Factura de exportación', 'B16');

-- Insertar productos iniciales (con referencias a categorías)
INSERT INTO public.products (name, price, cost, barcode, category_id, stock, min_stock) VALUES
  ('Café Premium 250g', 12.50, 8.00, '7501234567890', (SELECT id FROM public.categories WHERE name = 'Bebidas'), 25, 10),
  ('Pan Integral', 3.75, 2.00, '7501234567891', (SELECT id FROM public.categories WHERE name = 'Panadería'), 5, 15),
  ('Leche Entera 1L', 2.25, 1.50, '7501234567892', (SELECT id FROM public.categories WHERE name = 'Lácteos'), 45, 20),
  ('Agua Mineral 500ml', 1.50, 1.00, '7501234567893', (SELECT id FROM public.categories WHERE name = 'Bebidas'), 100, 30),
  ('Yogurt Natural', 4.00, 2.50, '7501234567894', (SELECT id FROM public.categories WHERE name = 'Lácteos'), 20, 10),
  ('Galletas Chocolate', 5.25, 3.00, '7501234567895', (SELECT id FROM public.categories WHERE name = 'Snacks'), 30, 15);

-- Insertar clientes iniciales
INSERT INTO public.customers (name, rnc, phone, email, address, customer_type, credit_limit, credit_used, total_purchases) VALUES
  ('Consumidor Final', '', '', '', '', 'final', 0, 0, 0),
  ('María González', '101234567', '(809) 555-0123', 'maria@email.com', 'Av. Principal #123, Santo Domingo', 'business', 5000, 1200, 15600),
  ('José Rodríguez', '201234567', '(809) 555-0124', 'jose@email.com', 'Calle 2 #456, Santiago', 'business', 3000, 2800, 8900),
  ('Empresa ABC S.R.L.', '301234567', '(809) 555-0125', 'contacto@abc.com', 'Zona Industrial, La Vega', 'business', 25000, 5600, 45000);

-- Actualizar el estado de productos con stock bajo
UPDATE public.products 
SET status = 'low_stock' 
WHERE stock < min_stock;

-- Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (permitir acceso público por ahora para desarrollo)
CREATE POLICY "Allow public access" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.customers FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.invoice_types FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.sales FOR ALL USING (true);
CREATE POLICY "Allow public access" ON public.sale_items FOR ALL USING (true);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_customers_rnc ON public.customers(rnc);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);
CREATE INDEX idx_sales_date ON public.sales(created_at);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);
