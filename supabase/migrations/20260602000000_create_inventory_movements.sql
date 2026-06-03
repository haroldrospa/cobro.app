-- Create inventory_movements table to audit stock changes
CREATE TABLE public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT, -- Back up user name for offline/fast load
    quantity_changed NUMERIC NOT NULL,
    previous_stock NUMERIC NOT NULL,
    new_stock NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for access control
CREATE POLICY "Users can view movements of their own store" 
    ON public.inventory_movements FOR SELECT 
    USING (auth.uid() IN (
        SELECT id FROM public.profiles WHERE store_id = inventory_movements.store_id
    ));

CREATE POLICY "Users can insert movements for their own store" 
    ON public.inventory_movements FOR INSERT 
    WITH CHECK (auth.uid() IN (
        SELECT id FROM public.profiles WHERE store_id = inventory_movements.store_id
    ));
