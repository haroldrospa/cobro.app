-- Fix RLS policies for inventory_movements
-- Run this in Supabase SQL Editor if you get 403 errors on inventory_movements

-- Drop old policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Users can view movements of their own store" ON public.inventory_movements;
DROP POLICY IF EXISTS "Users can insert movements for their own store" ON public.inventory_movements;
DROP POLICY IF EXISTS "Users can update movements of their own store" ON public.inventory_movements;
DROP POLICY IF EXISTS "Users can delete movements of their own store" ON public.inventory_movements;

-- Re-create with more robust EXISTS check and full CRUD coverage
CREATE POLICY "Users can view movements of their own store"
    ON public.inventory_movements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.store_id = inventory_movements.store_id
        )
    );

CREATE POLICY "Users can insert movements for their own store"
    ON public.inventory_movements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.store_id = inventory_movements.store_id
        )
    );

CREATE POLICY "Users can update movements of their own store"
    ON public.inventory_movements FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.store_id = inventory_movements.store_id
        )
    );

CREATE POLICY "Users can delete movements of their own store"
    ON public.inventory_movements FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.store_id = inventory_movements.store_id
        )
    );
