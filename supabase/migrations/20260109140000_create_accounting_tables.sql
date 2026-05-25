
-- Create Suppliers Table
create table if not exists public.suppliers (
  id uuid not null default gen_random_uuid(),
  store_id uuid references public.stores(id),
  name text not null,
  rnc text,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_pkey primary key (id)
);

-- Create Expenses Table
create table if not exists public.expenses (
  id uuid not null default gen_random_uuid(),
  store_id uuid references public.stores(id),
  date timestamptz not null,
  description text not null,
  amount numeric not null,
  category text not null,
  supplier_id uuid references public.suppliers(id),
  invoice_number text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_pkey primary key (id)
);

-- Add RLS Policies for Suppliers
alter table public.suppliers enable row level security;

drop policy if exists "Users can view suppliers from their store" on public.suppliers;
create policy "Users can view suppliers from their store"
  on public.suppliers for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can insert suppliers to their store" on public.suppliers;
create policy "Users can insert suppliers to their store"
  on public.suppliers for insert
  with check (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can update suppliers from their store" on public.suppliers;
create policy "Users can update suppliers from their store"
  on public.suppliers for update
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can delete suppliers from their store" on public.suppliers;
create policy "Users can delete suppliers from their store"
  on public.suppliers for delete
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

-- Add RLS Policies for Expenses
alter table public.expenses enable row level security;

drop policy if exists "Users can view expenses from their store" on public.expenses;
create policy "Users can view expenses from their store"
  on public.expenses for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can insert expenses to their store" on public.expenses;
create policy "Users can insert expenses to their store"
  on public.expenses for insert
  with check (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can update expenses from their store" on public.expenses;
create policy "Users can update expenses from their store"
  on public.expenses for update
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can delete expenses from their store" on public.expenses;
create policy "Users can delete expenses from their store"
  on public.expenses for delete
  using (store_id in (select store_id from public.profiles where id = auth.uid()));
