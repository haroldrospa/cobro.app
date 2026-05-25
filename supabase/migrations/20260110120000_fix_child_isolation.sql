-- Add store_id to remaining tables for better isolation and backup performance

-- Sale Items
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'store_id') THEN
        ALTER TABLE public.sale_items ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;
END $$;

-- Payroll Items
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_items' AND column_name = 'store_id') THEN
        ALTER TABLE public.payroll_items ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;
END $$;

-- Open Order Items
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'open_order_items' AND column_name = 'store_id') THEN
        ALTER TABLE public.open_order_items ADD COLUMN store_id UUID REFERENCES public.stores(id);
    END IF;
END $$;

-- Backfill store_id from parents if possible
UPDATE public.sale_items si
SET store_id = s.store_id
FROM public.sales s
WHERE si.sale_id = s.id AND si.store_id IS NULL;

UPDATE public.payroll_items pi
SET store_id = p.store_id
FROM public.payrolls p
WHERE pi.payroll_id = p.id AND pi.store_id IS NULL;

UPDATE public.open_order_items ooi
SET store_id = oo.store_id
FROM public.open_orders oo
WHERE ooi.order_id = oo.id AND ooi.store_id IS NULL;

-- Enable RLS on these tables
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for sale_items
DROP POLICY IF EXISTS "Users can manage own store sale_items" ON public.sale_items;
CREATE POLICY "Users can manage own store sale_items" ON public.sale_items
FOR ALL USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR
    (sale_id IN (SELECT id FROM public.sales WHERE store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())))
);

-- Policies for payroll_items
DROP POLICY IF EXISTS "Users can manage own store payroll_items" ON public.payroll_items;
CREATE POLICY "Users can manage own store payroll_items" ON public.payroll_items
FOR ALL USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR
    (payroll_id IN (SELECT id FROM public.payrolls WHERE store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())))
);
