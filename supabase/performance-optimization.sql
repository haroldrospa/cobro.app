-- =====================================================
-- PERFORMANCE OPTIMIZATION: DATABASE INDICES
-- =====================================================

-- 1. Indexing Products for faster POS search and categorization
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON public.products(internal_code);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 2. Indexing Sales for faster reporting and history
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_type_id ON public.sales(invoice_type_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status);

-- 3. Indexing Sale Items for faster invoice loading
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- 4. Indexing Customers for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_rnc ON public.customers(rnc);

-- 5. Indexing Inventory Transactions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON public.inventory_transactions(product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at DESC);
    END IF;
END $$;

-- 6. Indexing Profiles and Store Settings
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON public.profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON public.store_settings(store_id);

-- 7. Indexing Recipes for Kitchen Display
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_recipes') THEN
        CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id ON public.product_recipes(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient_id ON public.product_recipes(ingredient_id);
    END IF;
END $$;

-- Summary of indices added
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
