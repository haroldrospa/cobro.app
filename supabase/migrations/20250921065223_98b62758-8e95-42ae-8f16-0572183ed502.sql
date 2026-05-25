-- Limpiar tablas existentes
DELETE FROM public.invoice_sequences;
DELETE FROM public.invoice_types;

-- Insertar los tipos de facturas oficiales de República Dominicana
INSERT INTO public.invoice_types (id, name, description, code) VALUES
('B01', 'Crédito Fiscal', 'Factura con derecho a crédito fiscal', 'B01'),
('B02', 'Consumidor Final', 'Factura para consumidor final', 'B02'),
('B03', 'Nota de Débito', 'Nota de débito fiscal', 'B03'),
('B04', 'Nota de Crédito', 'Nota de crédito fiscal', 'B04'),
('B11', 'Proveedores del Estado', 'Registro de ingresos - Proveedores del Estado', 'B11'),
('B12', 'Registro Único de Ingresos', 'Registro único de ingresos', 'B12'),
('B13', 'Gastos Menores', 'Comprobante de compras - Gastos menores', 'B13'),
('B14', 'Regímenes Especiales', 'Regímenes especiales de tributación', 'B14'),
('B15', 'Comprobante Gubernamental', 'Comprobante gubernamental', 'B15'),
('B16', 'Exportaciones', 'Comprobante para exportaciones', 'B16');

-- Insertar las secuencias correspondientes
INSERT INTO public.invoice_sequences (invoice_type_id, current_number) VALUES
('B01', 1),
('B02', 1), 
('B03', 1),
('B04', 1),
('B11', 1),
('B12', 1),
('B13', 1),
('B14', 1),
('B15', 1),
('B16', 1);