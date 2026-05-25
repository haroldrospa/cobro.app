-- =====================================================
-- ADVANCED PERFORMANCE OPTIMIZATION: SYSTEM-WIDE
-- =====================================================

-- 1. Optimized Indices for Recently Added Features
CREATE INDEX IF NOT EXISTS idx_pos_quick_notes_store_id ON public.pos_quick_notes(store_id);
CREATE INDEX IF NOT EXISTS idx_pos_quick_notes_created_at ON public.pos_quick_notes(created_at DESC);

-- 2. Indices for Product Offers & Discounts (Speed up POS calculations)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_offers') THEN
        CREATE INDEX IF NOT EXISTS idx_product_offers_product_id ON public.product_offers(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_offers_store_id ON public.product_offers(store_id);
        CREATE INDEX IF NOT EXISTS idx_product_offers_status ON public.product_offers(status) WHERE status = 'active';
    END IF;
END $$;

-- 3. Indices for Loyalty System
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loyalty_points') THEN
        CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer_id ON public.loyalty_points(customer_id);
        CREATE INDEX IF NOT EXISTS idx_loyalty_points_store_id ON public.loyalty_points(store_id);
    END IF;
END $$;

-- 4. Indices for Cash Sessions (NCF & Daily Closing)
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_id_status ON public.cash_sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON public.cash_sessions(opened_at DESC);

-- 5. Optimized Foreign Key Indices (Prevent Sequential Scans on Joins)
CREATE INDEX IF NOT EXISTS idx_sales_invoice_sequence_id ON public.sales(invoice_sequence_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id); -- Primary but explicit index helps some query planners

-- 6. Full Text Search Index for Products (Optional but good for scalability)
-- Using GIN index for faster search on name and barcode
CREATE INDEX IF NOT EXISTS idx_products_search_trgm ON public.products USING gin (name gin_trgm_ops);

-- 7. Statistics for the Query Planner
ANALYZE public.products;
ANALYZE public.sales;
ANALYZE public.sale_items;
ANALYZE public.customers;
