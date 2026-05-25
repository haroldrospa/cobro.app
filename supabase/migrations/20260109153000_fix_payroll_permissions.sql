
-- 1. Ensure base_salary column exists
alter table public.profiles add column if not exists base_salary numeric default 0;

-- 2. Allow Admins and Managers to update OTHER profiles in the same store
-- (Standard RLS usually only allows updating your OWN profile)

drop policy if exists "Admins/Managers can update store profiles" on public.profiles;

create policy "Admins/Managers can update store profiles"
on public.profiles
for update
using (
  -- The user performing the action must be an admin/manager of the same store
  exists (
    select 1 from public.profiles as auth_user
    where auth_user.id = auth.uid()
    and auth_user.store_id = profiles.store_id
    and auth_user.role in ('admin', 'manager')
  )
);

-- 3. Ensure they can also select/view these profiles (usually covered, but good to ensure)
drop policy if exists "Admins/Managers can view store profiles" on public.profiles;

create policy "Admins/Managers can view store profiles"
on public.profiles
for select
using (
  auth.uid() = id -- Can view own
  OR
  exists ( -- Can view store members if admin/manager
    select 1 from public.profiles as auth_user
    where auth_user.id = auth.uid()
    and auth_user.store_id = profiles.store_id
    and auth_user.role in ('admin', 'manager')
  )
);
