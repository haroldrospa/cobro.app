-- Drop the existing role check constraint if it exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the new role check constraint with all necessary roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'staff', 'customer'));
