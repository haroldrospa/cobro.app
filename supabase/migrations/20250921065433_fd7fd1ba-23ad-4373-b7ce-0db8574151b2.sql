-- Actualizar las ventas para usar los IDs en mayúsculas
UPDATE public.sales SET invoice_type_id = 'B01' WHERE invoice_type_id = 'b01';
UPDATE public.sales SET invoice_type_id = 'B02' WHERE invoice_type_id = 'b02';
UPDATE public.sales SET invoice_type_id = 'B03' WHERE invoice_type_id = 'b03';
UPDATE public.sales SET invoice_type_id = 'B14' WHERE invoice_type_id = 'b14';
UPDATE public.sales SET invoice_type_id = 'B15' WHERE invoice_type_id = 'b15';
UPDATE public.sales SET invoice_type_id = 'B16' WHERE invoice_type_id = 'b16';

-- Ahora eliminar los tipos duplicados en minúsculas
DELETE FROM public.invoice_types WHERE id IN ('b01', 'b02', 'b03', 'b14', 'b15', 'b16');

-- Actualizar los tipos existentes con los nombres correctos de República Dominicana
UPDATE public.invoice_types SET 
  name = 'Crédito Fiscal', 
  description = 'Factura con derecho a crédito fiscal' 
WHERE id = 'B01';

UPDATE public.invoice_types SET 
  name = 'Consumidor Final', 
  description = 'Factura para consumidor final' 
WHERE id = 'B02';

UPDATE public.invoice_types SET 
  name = 'Nota de Débito', 
  description = 'Nota de débito fiscal' 
WHERE id = 'B03';

UPDATE public.invoice_types SET 
  name = 'Regímenes Especiales', 
  description = 'Regímenes especiales de tributación' 
WHERE id = 'B14';

UPDATE public.invoice_types SET 
  name = 'Comprobante Gubernamental', 
  description = 'Comprobante gubernamental' 
WHERE id = 'B15';

UPDATE public.invoice_types SET 
  name = 'Exportaciones', 
  description = 'Comprobante para exportaciones' 
WHERE id = 'B16';

-- Insertar los tipos faltantes de República Dominicana
INSERT INTO public.invoice_types (id, name, description, code) VALUES
('B04', 'Nota de Crédito', 'Nota de crédito fiscal', 'B04'),
('B11', 'Proveedores del Estado', 'Registro de ingresos - Proveedores del Estado', 'B11'),
('B12', 'Registro Único de Ingresos', 'Registro único de ingresos', 'B12'),
('B13', 'Gastos Menores', 'Comprobante de compras - Gastos menores', 'B13');

-- Insertar secuencias para los tipos nuevos
INSERT INTO public.invoice_sequences (invoice_type_id, current_number) VALUES
('B04', 1),
('B11', 1),
('B12', 1),
('B13', 1);