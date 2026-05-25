-- POLICY FIX FOR PUBLIC STORE ACCESS
-- Run this in your Supabase SQL Editor to fix the issue where products don't show up for customers

-- 1. Allow public to view active stores
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
CREATE POLICY "Public can view active stores" 
ON public.stores
FOR SELECT 
USING (is_active = true);

-- 2. Allow public to view active products of active stores
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products" 
ON public.products
FOR SELECT 
USING (
  status = 'active'
);

-- 3. Allow public to view categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" 
ON public.categories
FOR SELECT 
USING (true);

-- 4. Allow public to view store settings (for theme, colors, etc.)
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" 
ON public.store_settings
FOR SELECT 
USING (true);

-- 5. Allow public to view company settings (logo, name, etc.)
DROP POLICY IF EXISTS "Public can view company settings" ON public.company_settings;
CREATE POLICY "Public can view company settings" 
ON public.company_settings
FOR SELECT 
USING (true);
