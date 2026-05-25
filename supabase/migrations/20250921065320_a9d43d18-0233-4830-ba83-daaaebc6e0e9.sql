-- Primero, actualizar las ventas existentes para que usen los IDs correctos
UPDATE public.sales 
SET invoice_type_id = 'B01' 
WHERE invoice_type_id IN ('b01', 'B01');

UPDATE public.sales 
SET invoice_type_id = 'B02' 
WHERE invoice_type_id IN ('b02', 'B02');

UPDATE public.sales 
SET invoice_type_id = 'B03' 
WHERE invoice_type_id IN ('b03', 'B03');

-- Eliminar duplicados de invoice_sequences manteniendo solo uno de cada tipo
DELETE FROM public.invoice_sequences 
WHERE id NOT IN (
  SELECT DISTINCT ON (invoice_type_id) id 
  FROM public.invoice_sequences 
  ORDER BY invoice_type_id, created_at DESC
);

-- Eliminar duplicados de invoice_types manteniendo solo uno de cada tipo
DELETE FROM public.invoice_types 
WHERE id NOT IN (
  SELECT DISTINCT ON (code) id 
  FROM public.invoice_types 
  ORDER BY code, id
);

-- Actualizar los tipos de facturas existentes con los nombres correctos de República Dominicana
UPDATE public.invoice_types SET name = 'Crédito Fiscal', description = 'Factura con derecho a crédito fiscal' WHERE id = 'B01';
UPDATE public.invoice_types SET name = 'Consumidor Final', description = 'Factura para consumidor final' WHERE id = 'B02';
UPDATE public.invoice_types SET name = 'Nota de Débito', description = 'Nota de débito fiscal' WHERE id = 'B03';

-- Insertar los tipos faltantes de República Dominicana si no existen
INSERT INTO public.invoice_types (id, name, description, code) 
SELECT 'B04', 'Nota de Crédito', 'Nota de crédito fiscal', 'B04'
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_types WHERE id = 'B04');

INSERT INTO public.invoice_types (id, name, description, code) 
SELECT 'B11', 'Proveedores del Estado', 'Registro de ingresos - Proveedores del Estado', 'B11'
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_types WHERE id = 'B11');

INSERT INTO public.invoice_types (id, name, description, code) 
SELECT 'B12', 'Registro Único de Ingresos', 'Registro único de ingresos', 'B12'
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_types WHERE id = 'B12');

INSERT INTO public.invoice_types (id, name, description, code) 
SELECT 'B13', 'Gastos Menores', 'Comprobante de compras - Gastos menores', 'B13'
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_types WHERE id = 'B13');

UPDATE public.invoice_types SET name = 'Regímenes Especiales', description = 'Regímenes especiales de tributación' WHERE id = 'B14';
UPDATE public.invoice_types SET name = 'Comprobante Gubernamental', description = 'Comprobante gubernamental' WHERE id = 'B15';
UPDATE public.invoice_types SET name = 'Exportaciones', description = 'Comprobante para exportaciones' WHERE id = 'B16';

-- Insertar secuencias para los tipos nuevos si no existen
INSERT INTO public.invoice_sequences (invoice_type_id, current_number) 
SELECT 'B04', 1
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = 'B04');

INSERT INTO public.invoice_sequences (invoice_type_id, current_number) 
SELECT 'B11', 1
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = 'B11');

INSERT INTO public.invoice_sequences (invoice_type_id, current_number) 
SELECT 'B12', 1
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = 'B12');

INSERT INTO public.invoice_sequences (invoice_type_id, current_number) 
SELECT 'B13', 1
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sequences WHERE invoice_type_id = 'B13');