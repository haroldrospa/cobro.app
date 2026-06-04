-- Create fixed_expenses table
create table if not exists public.fixed_expenses (
  id uuid not null default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  description text not null,
  amount numeric not null,
  category text not null,
  due_day integer not null check (due_day >= 1 and due_day <= 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_expenses_pkey primary key (id)
);

-- Add fixed_expense_id column to expenses
alter table public.expenses 
add column if not exists fixed_expense_id uuid references public.fixed_expenses(id) on delete set null;

-- Enable RLS for fixed_expenses
alter table public.fixed_expenses enable row level security;

-- RLS Policies for fixed_expenses
drop policy if exists "Users can view fixed_expenses from their store" on public.fixed_expenses;
create policy "Users can view fixed_expenses from their store"
  on public.fixed_expenses for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can insert fixed_expenses to their store" on public.fixed_expenses;
create policy "Users can insert fixed_expenses to their store"
  on public.fixed_expenses for insert
  with check (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can update fixed_expenses from their store" on public.fixed_expenses;
create policy "Users can update fixed_expenses from their store"
  on public.fixed_expenses for update
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Users can delete fixed_expenses from their store" on public.fixed_expenses;
create policy "Users can delete fixed_expenses from their store"
  on public.fixed_expenses for delete
  using (store_id in (select store_id from public.profiles where id = auth.uid()));
