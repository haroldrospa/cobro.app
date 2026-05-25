
-- Add JSONB columns for multiple deduction details
alter table public.profiles add column if not exists default_deductions_details jsonb default '[]'::jsonb;
alter table public.payroll_items add column if not exists deductions_details jsonb default '[]'::jsonb;

-- Refresh schema cache
notify pgrst, 'reload schema';
