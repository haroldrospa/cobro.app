-- 1. Asegurar que la columna existe en la tabla 'expenses'
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS fixed_expense_id UUID REFERENCES public.fixed_expenses(id) ON DELETE SET NULL;

-- 2. Recargar el caché de esquema de PostgREST en Supabase
NOTIFY pgrst, 'reload schema';
