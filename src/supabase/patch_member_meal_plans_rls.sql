-- Kjør i Supabase SQL Editor hvis medlem ikke ser matvarer PT har lagt inn.
-- Utvider SELECT-policy slik at JWT member_id matcher (som øvrige medlemstabeller).

drop policy if exists "member_meal_plans_select" on public.member_meal_plans;
create policy "member_meal_plans_select"
  on public.member_meal_plans
  for select
  to authenticated
  using (
    auth.uid() = owner_user_id
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or member_id in (
      select m.id::text
      from public.members m
      where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
