-- Require roster ownership for member_meal_plans writes.
-- Previous insert/update policies only checked auth.uid() = owner_user_id, so any
-- authenticated user could claim an empty meal-plan slot for any member_id (including
-- their own) and permanently block the real PT's upsert path.
-- Kjør i Supabase SQL Editor.

drop policy if exists "member_meal_plans_insert_own" on public.member_meal_plans;
create policy "member_meal_plans_insert_own"
  on public.member_meal_plans
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "member_meal_plans_update_own" on public.member_meal_plans;
create policy "member_meal_plans_update_own"
  on public.member_meal_plans
  for update
  to authenticated
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  )
  with check (
    auth.uid() = owner_user_id
    and exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );
