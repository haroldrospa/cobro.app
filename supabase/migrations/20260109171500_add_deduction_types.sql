
-- Add Deduction Types to stores
alter table public.stores add column if not exists afp_type text default 'percentage'; -- 'percentage' or 'fixed'
alter table public.stores add column if not exists sfs_type text default 'percentage';
alter table public.stores add column if not exists isr_type text default 'percentage';
alter table public.stores add column if not exists infotep_type text default 'percentage';

-- Refresh schema cache
notify pgrst, 'reload schema';
