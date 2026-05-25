-- Drop the legacy global unique constraint
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;

-- Also check if there's a unique index causing this
DROP INDEX IF EXISTS sales_invoice_number_key;

-- Create a new unique constraint scoped by store_id
-- This allows multiple stores to have "B01-00000001" as long as they have different store_ids
ALTER TABLE public.sales ADD CONSTRAINT sales_invoice_number_store_id_key UNIQUE (invoice_number, store_id);
