
-- 1. Create Payrolls Table (Periodos)
create table if not exists public.payrolls (
    id uuid default gen_random_uuid() primary key,
    store_id uuid not null references public.stores(id) on delete cascade,
    period_start timestamptz not null,
    period_end timestamptz not null,
    total_amount numeric default 0,
    status text check (status in ('draft', 'processed', 'paid')) default 'draft',
    created_at timestamptz default now()
);

-- 2. Create Payroll Items Table (Detalles)
create table if not exists public.payroll_items (
    id uuid default gen_random_uuid() primary key,
    payroll_id uuid not null references public.payrolls(id) on delete cascade,
    profile_id uuid references public.profiles(id) on delete set null,
    employee_name text,
    base_salary numeric default 0,
    bonuses numeric default 0,
    deductions numeric default 0,
    tss numeric default 0,         -- New DR
    infotep numeric default 0,     -- New DR
    regalia numeric default 0,     -- New DR
    severance numeric default 0,   -- New DR (Liquidacion)
    net_salary numeric default 0,
    status text check (status in ('pending', 'paid')) default 'pending',
    note text,
    created_at timestamptz default now()
);

-- 3. Ensure Profiles has necessary columns
alter table public.profiles add column if not exists base_salary numeric default 0;
alter table public.profiles add column if not exists tss numeric default 0;
alter table public.profiles add column if not exists infotep numeric default 0;
alter table public.profiles add column if not exists default_deduction numeric default 0;
alter table public.profiles add column if not exists default_deduction_note text default '';

-- 4. Enable RLS
alter table public.payrolls enable row level security;
alter table public.payroll_items enable row level security;

-- 5. Helper Function for Admin Check (Prevents Recursion)
create or replace function public.is_admin_of_store_secure(lookup_store_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and store_id = lookup_store_id
    and role in ('admin', 'manager')
  );
end;
$$;

-- 6. RLS Policies for Payrolls
drop policy if exists "Store Admins can manage payrolls" on public.payrolls;
create policy "Store Admins can manage payrolls"
on public.payrolls
for all
using (
    public.is_admin_of_store_secure(store_id)
);

-- 7. RLS Policies for Payroll Items
drop policy if exists "Store Admins can manage payroll items" on public.payroll_items;
create policy "Store Admins can manage payroll items"
on public.payroll_items
for all
using (
    exists (
        select 1 from public.payrolls
        where payrolls.id = payroll_items.payroll_id
        and public.is_admin_of_store_secure(payrolls.store_id)
    )
);

-- 8. Fix Profile Permissions (Allow Admins to edit salaries)
drop policy if exists "Admins/Managers can update store profiles" on public.profiles;
create policy "Admins/Managers can update store profiles"
on public.profiles
for update
using (
  auth.uid() = id
  OR
  public.is_admin_of_store_secure(store_id)
);

drop policy if exists "Admins/Managers can view store profiles" on public.profiles;
create policy "Admins/Managers can view store profiles"
on public.profiles
for select
using (
  auth.uid() = id
  OR
  public.is_admin_of_store_secure(store_id)
);
