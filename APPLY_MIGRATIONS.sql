-- =====================================================
-- SCRIPT DE MIGRACIONES PENDIENTES
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar configuraciones de factura
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS invoice_company_name TEXT,
ADD COLUMN IF NOT EXISTS invoice_company_address TEXT,
ADD COLUMN IF NOT EXISTS invoice_company_phone TEXT,
ADD COLUMN IF NOT EXISTS invoice_company_email TEXT,
ADD COLUMN IF NOT EXISTS invoice_company_tax_id TEXT,
ADD COLUMN IF NOT EXISTS invoice_footer_text TEXT,
ADD COLUMN IF NOT EXISTS print_paper_size TEXT DEFAULT '80mm';

COMMENT ON COLUMN store_settings.print_paper_size IS 'Paper size for printing: 58mm or 80mm';

-- 2. Agregar visibilidad de productos en tienda
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_visible_in_store BOOLEAN DEFAULT true;

UPDATE products SET is_visible_in_store = true WHERE is_visible_in_store IS NULL;

COMMENT ON COLUMN products.is_visible_in_store IS 'If true, product is visible in the public store. If false, only visible in POS.';

-- 3. Agregar control de inventario opcional
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

UPDATE products SET track_inventory = true WHERE track_inventory IS NULL;

COMMENT ON COLUMN products.track_inventory IS 'If true, product has stock control. If false, stock is ignored (for services, digital products, etc.)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las columnas existen
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'store_settings' 
    AND column_name IN (
        'invoice_company_name',
        'invoice_company_address', 
        'invoice_company_phone',
        'invoice_company_email',
        'invoice_company_tax_id',
        'invoice_footer_text',
        'print_paper_size'
    );

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
    AND column_name IN ('is_visible_in_store', 'track_inventory');
