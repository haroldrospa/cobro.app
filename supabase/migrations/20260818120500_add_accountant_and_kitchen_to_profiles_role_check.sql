-- Update profiles_role_check to include 'accountant' and 'kitchen'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'cashier', 'delivery', 'kitchen', 'staff', 'customer', 'owner', 'accountant'));
