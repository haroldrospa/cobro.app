
-- Add base_salary to profiles
alter table public.profiles add column if not exists base_salary numeric default 0;

-- Create Payrolls Table
create table if not exists public.payrolls (
  id uuid not null default gen_random_uuid(),
  store_id uuid references public.stores(id),
  period_start date not null,
  period_end date not null,
  total_amount numeric default 0,
  status text default 'draft', -- draft, processed, paid
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payrolls_pkey primary key (id)
);

-- Create Payroll Items Table
create table if not exists public.payroll_items (
  id uuid not null default gen_random_uuid(),
  payroll_id uuid references public.payrolls(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  employee_name text, 
  base_salary numeric not null default 0,
  bonuses numeric default 0,
  deductions numeric default 0,
  net_salary numeric not null default 0,
  payment_date timestamptz,
  status text default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_items_pkey primary key (id)
);

-- RLS Policies
alter table public.payrolls enable row level security;
alter table public.payroll_items enable row level security;

-- Payrolls Policies
create policy "Users can view payrolls from their store" on public.payrolls
  for select using (store_id in (select store_id from public.profiles where id = auth.uid()));

create policy "Users can insert payrolls to their store" on public.payrolls
  for insert with check (store_id in (select store_id from public.profiles where id = auth.uid()));

create policy "Users can update payrolls from their store" on public.payrolls
  for update using (store_id in (select store_id from public.profiles where id = auth.uid()));

create policy "Users can delete payrolls from their store" on public.payrolls
  for delete using (store_id in (select store_id from public.profiles where id = auth.uid()));

-- Payroll Items Policies (Associated via Payroll ID usually, but for simplicity of RLS check, we reuse store logic indirectly or just allow access if user has access to the payroll)
-- Simplified approach: Users can see all items if they can see the parent payroll. 
-- Since Supabase RLS on join is tricky, a simpler way for items is to trust that if you can SELECT the payroll, you can select items.
-- Actually, let's keep it robust. We will assume the user has access to the payroll.
create policy "Users can view payroll items" on public.payroll_items
  for select using (
    exists (select 1 from public.payrolls p where p.id = payroll_items.payroll_id and p.store_id in (select store_id from public.profiles where id = auth.uid()))
  );

create policy "Users can insert payroll items" on public.payroll_items
  for insert with check (
    exists (select 1 from public.payrolls p where p.id = payroll_items.payroll_id and p.store_id in (select store_id from public.profiles where id = auth.uid()))
  );

create policy "Users can update payroll items" on public.payroll_items
  for update using (
    exists (select 1 from public.payrolls p where p.id = payroll_items.payroll_id and p.store_id in (select store_id from public.profiles where id = auth.uid()))
  );

create policy "Users can delete payroll items" on public.payroll_items
  for delete using (
    exists (select 1 from public.payrolls p where p.id = payroll_items.payroll_id and p.store_id in (select store_id from public.profiles where id = auth.uid()))
  );
