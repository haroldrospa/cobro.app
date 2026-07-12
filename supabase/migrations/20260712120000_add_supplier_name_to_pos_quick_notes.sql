-- Migration: Add supplier_name column to pos_quick_notes table
ALTER TABLE public.pos_quick_notes 
ADD COLUMN IF NOT EXISTS supplier_name TEXT;
