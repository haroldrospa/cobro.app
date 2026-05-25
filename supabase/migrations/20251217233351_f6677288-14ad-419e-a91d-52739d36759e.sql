-- Agregar columna de fecha de vencimiento de crédito a clientes
ALTER TABLE public.customers 
ADD COLUMN credit_due_date timestamp with time zone;