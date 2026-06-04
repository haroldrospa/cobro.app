-- Create supplier_debts table
create table if not exists public.supplier_debts (
  id uuid not null default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  amount numeric not null,
  amount_paid numeric not null default 0,
  description text not null,
  category text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_debts_pkey primary key (id)
);

-- Add supplier_debt_id column to expenses
alter table public.expenses 
add column if not exists supplier_debt_id uuid references public.supplier_debts(id) on delete set null;

-- Enable RLS for supplier_debts
alter table public.supplier_debts enable row level security;

-- RLS Policies for supplier_debts
drop policy if exists "Users can view supplier_debts from their store" on public.supplier_debts;
create policy "Users can view supplier_debts from their store"
  on public.supplier_debts for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can insert supplier_debts to their store" on public.supplier_debts;
create policy "Users can insert supplier_debts to their store"
  on public.supplier_debts for insert
  with check (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can update supplier_debts from their store" on public.supplier_debts;
create policy "Users can update supplier_debts from their store"
  on public.supplier_debts for update
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can delete supplier_debts from their store" on public.supplier_debts;
create policy "Users can delete supplier_debts from their store"
  on public.supplier_debts for delete
  using (store_id in (select store_id from public.profiles where id = auth.uid()));
