-- Secure CASH SESSIONS Table with Strict Isolation
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Remove old permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cash_sessions;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.cash_sessions;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.cash_sessions;

-- Create strict isolation policy using the secure function
CREATE POLICY "Cash sessions isolation policy" 
ON public.cash_sessions
FOR ALL 
USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());
