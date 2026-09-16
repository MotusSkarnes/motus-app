-- PT skal kunne skrive matplan for egne kunder selv om member_meal_plans.owner_user_id er utdatert.
-- Uten denne patchen kan upsert feile stille, og planen blir bare liggende i nettleseren.
-- Kjør i Supabase SQL Editor.

drop policy if exists "member_meal_plans_insert_own" on public.member_meal_plans;
drop policy if exists "member_meal_plans_insert" on public.member_meal_plans;
create policy "member_meal_plans_insert"
  on public.member_meal_plans
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists "member_meal_plans_update_own" on public.member_meal_plans;
drop policy if exists "member_meal_plans_update" on public.member_meal_plans;
create policy "member_meal_plans_update"
  on public.member_meal_plans
  for update
  to authenticated
  using (
    auth.uid() = owner_user_id
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
    )
  )
  with check (auth.uid() = owner_user_id);
