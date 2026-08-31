-- Per-employee flag: whether this profile should get a payroll_item
-- generated when a new payroll period is created. Lets store owners mark
-- app users who have access but no salary (e.g. family helpers, viewer-only
-- accounts) so they never show up in payroll generation, instead of getting
-- a $0 line item that has to be filtered out after the fact.
-- Default true preserves current behavior for all existing employees.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS include_in_payroll boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.include_in_payroll IS
  'Whether a payroll_item should be generated for this profile when a new payroll period is created.';
