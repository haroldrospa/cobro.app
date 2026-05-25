
-- 1. Create a helper function with SECURITY DEFINER to bypass RLS recursion
-- This function runs with the privileges of the creator (postgres/superuser), not the invoker.
create or replace function public.is_admin_of_store(lookup_store_id uuid)
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

-- 2. Fix UPDATE Policy
drop policy if exists "Admins/Managers can update store profiles" on public.profiles;

create policy "Admins/Managers can update store profiles"
on public.profiles
for update
using (
  auth.uid() = id -- Can update self
  OR
  public.is_admin_of_store(store_id) -- Or is admin (uses secure function)
);

-- 3. Fix SELECT Policy (Prevent infinite recursion here too)
drop policy if exists "Admins/Managers can view store profiles" on public.profiles;

create policy "Admins/Managers can view store profiles"
on public.profiles
for select
using (
  auth.uid() = id -- Can view self
  OR
  public.is_admin_of_store(store_id) -- Or is admin (uses secure function)
);
