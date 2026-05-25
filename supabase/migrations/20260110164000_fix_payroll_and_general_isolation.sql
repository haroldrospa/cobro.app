-- 1. Secure PAYROLLS Table
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payrolls isolation policy" ON public.payrolls;

CREATE POLICY "Payrolls isolation policy" 
ON public.payrolls
FOR ALL 
USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

-- 2. Secure PAYROLL ITEMS Table
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payroll items isolation policy" ON public.payroll_items;

CREATE POLICY "Payroll items isolation policy" 
ON public.payroll_items
FOR ALL 
USING (
    payroll_id IN (
        SELECT id FROM public.payrolls 
        WHERE store_id = public.get_auth_store_id()
    )
)
WITH CHECK (
    payroll_id IN (
        SELECT id FROM public.payrolls 
        WHERE store_id = public.get_auth_store_id()
    )
);

-- 3. Also secure SALES, CUSTOMERS, PRODUCTS, CATEGORIES with the new Safe Function
-- This ensures consistency across the app and prevents recursion in other areas

-- SALES
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales isolation policy" ON public.sales;
DROP POLICY IF EXISTS "Users can view own store sales" ON public.sales;

CREATE POLICY "Sales isolation policy" ON public.sales
FOR ALL USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

-- CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers isolation policy" ON public.customers;
DROP POLICY IF EXISTS "Users can view own store customers" ON public.customers;

CREATE POLICY "Customers isolation policy" ON public.customers
FOR ALL USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products isolation policy" ON public.products;
DROP POLICY IF EXISTS "Users can view own store products" ON public.products;

CREATE POLICY "Products isolation policy" ON public.products
FOR ALL USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());

-- CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories isolation policy" ON public.categories;
DROP POLICY IF EXISTS "Users can view own store categories" ON public.categories;

CREATE POLICY "Categories isolation policy" ON public.categories
FOR ALL USING (store_id = public.get_auth_store_id())
WITH CHECK (store_id = public.get_auth_store_id());
