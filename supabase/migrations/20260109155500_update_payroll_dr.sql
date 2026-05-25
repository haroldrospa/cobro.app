
-- Update Profiles: Rename health_insurance to tss (conceptually) or just add new columns
-- We'll just add new ones to be safe and cleaner
alter table public.profiles add column if not exists tss numeric default 0; -- Default fixed amount or rate? Assuming amount per user request to "edit"
alter table public.profiles add column if not exists infotep numeric default 0;

-- Update Payroll Items: Add columns for the specific period record
alter table public.payroll_items add column if not exists tss numeric default 0;
alter table public.payroll_items add column if not exists infotep numeric default 0;
alter table public.payroll_items add column if not exists regalia numeric default 0;
alter table public.payroll_items add column if not exists severance numeric default 0; -- Liquidacion

-- Note: We will migrate logic in UI.
