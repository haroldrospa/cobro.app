
-- Add Deduction Rates to Stores
alter table public.stores add column if not exists afp_rate numeric default 2.87;
alter table public.stores add column if not exists sfs_rate numeric default 3.04;
alter table public.stores add column if not exists isr_rate numeric default 0;

-- Add Deduction Toggles to Profiles
alter table public.profiles add column if not exists apply_afp boolean default false;
alter table public.profiles add column if not exists apply_sfs boolean default false;
alter table public.profiles add column if not exists apply_isr boolean default false;

-- Add columns to payroll_items to store the *applied* amounts separately if we want detailed reporting, 
-- or we can just sum them into 'deductions' or 'tss'. 
-- The user previous had 'tss', 'infotep'.
-- standard practice: TSS = AFP + SFS. 
-- ISR is separate.
-- Let's ensure payroll_items has isr column.
alter table public.payroll_items add column if not exists isr numeric default 0;

-- Refresh schema cache
notify pgrst, 'reload schema';
