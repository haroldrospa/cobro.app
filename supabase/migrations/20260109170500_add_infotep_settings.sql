
-- Add Infotep Settings to stores
alter table public.stores add column if not exists enable_infotep boolean default false;
alter table public.stores add column if not exists infotep_rate numeric default 1.0;

-- Refresh schema cache
notify pgrst, 'reload schema';
