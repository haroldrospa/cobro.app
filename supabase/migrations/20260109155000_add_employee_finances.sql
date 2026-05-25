
-- Add recurring finance columns to profiles
alter table public.profiles add column if not exists health_insurance numeric default 0;
alter table public.profiles add column if not exists default_deduction numeric default 0;
alter table public.profiles add column if not exists default_deduction_note text default '';
