-- Migration: Add apply_law_deductions to profiles
alter table public.profiles add column if not exists apply_law_deductions boolean default false;
alter table public.profiles add column if not exists apply_afp boolean default false;
alter table public.profiles add column if not exists apply_sfs boolean default false;

-- Sync existing apply_afp/apply_sfs with apply_law_deductions if any
update public.profiles
set apply_law_deductions = true
where apply_afp = true or apply_sfs = true;

notify pgrst, 'reload schema';
