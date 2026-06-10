-- PT skal kunne lese matplan for egne kunder selv om member_meal_plans.owner_user_id er utdatert.
-- Kjør i Supabase SQL Editor hvis PT ser «Matplanen vises ikke akkurat nå».

drop policy if exists "member_meal_plans_select" on public.member_meal_plans;
create policy "member_meal_plans_select"
  on public.member_meal_plans
  for select
  to authenticated
  using (
    auth.uid() = owner_user_id
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
    )
  );
