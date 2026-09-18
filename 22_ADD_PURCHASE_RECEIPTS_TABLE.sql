-- ==============================================================================
-- MIGRACIÓN: Tabla purchase_receipts (Comprobantes de Compras e-CF 41 / B11)
-- ==============================================================================

-- 1. Insertar o verificar el tipo de factura B11 en invoice_types
INSERT INTO invoice_types (id, code, name, description)
VALUES ('B11', 'B11', 'Comprobante de Compras', 'Comprobante fiscal para compras a personas físicas no registradas')
ON CONFLICT (id) DO NOTHING;

-- 2. Crear tabla purchase_receipts
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    supplier_rnc_cedula TEXT NOT NULL,
    ncf TEXT NOT NULL,
    ncf_type TEXT NOT NULL DEFAULT 'E41',
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    itbis_rate NUMERIC(5, 2) NOT NULL DEFAULT 18,
    itbis_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    itbis_retained NUMERIC(14, 2) NOT NULL DEFAULT 0,
    itbis_retention_rate NUMERIC(5, 2) NOT NULL DEFAULT 100,
    isr_retention_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    isr_retained NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_net_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    category TEXT NOT NULL DEFAULT 'Inventario',
    status TEXT NOT NULL DEFAULT 'EMITIDO',
    is_electronic BOOLEAN NOT NULL DEFAULT true,
    security_code TEXT,
    qrcode_url TEXT,
    alanube_id TEXT,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para rendimiento óptimo
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_store_id ON purchase_receipts(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_issue_date ON purchase_receipts(issue_date);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_ncf ON purchase_receipts(ncf);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier_id ON purchase_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_status ON purchase_receipts(status);

-- 4. Habilitar RLS
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de seguridad RLS basadas en store_id
DROP POLICY IF EXISTS "Users can manage purchase receipts of their store" ON purchase_receipts;
CREATE POLICY "Users can manage purchase receipts of their store"
ON purchase_receipts
FOR ALL
USING (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
);
