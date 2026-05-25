
-- Add Global Toggle columns to stores
alter table public.stores add column if not exists enable_afp boolean default true;
alter table public.stores add column if not exists enable_sfs boolean default true;
alter table public.stores add column if not exists enable_isr boolean default false;

-- Refresh schema cache
notify pgrst, 'reload schema';
