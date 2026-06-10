-- Fjerner user_metadata fra member_meal_plan_state_select og member_meal_plan_state_upsert_own.
-- Medlem: app_metadata.member_id (serverstyrt) eller e-postkobling i members.
-- PT: leser via matplan-eierskap (kun SELECT).
-- Kjør i Supabase SQL Editor.

drop policy if exists "member_meal_plan_state_select" on public.member_meal_plan_state;

create policy "member_meal_plan_state_select"
  on public.member_meal_plan_state
  for select to authenticated
  using (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plan_state.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
    or exists (
      select 1
      from public.member_meal_plans mp
      where mp.member_id = member_meal_plan_state.member_id
        and mp.owner_user_id = auth.uid()
    )
  );

drop policy if exists "member_meal_plan_state_upsert_own" on public.member_meal_plan_state;

create policy "member_meal_plan_state_upsert_own"
  on public.member_meal_plan_state
  for all to authenticated
  using (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plan_state.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  )
  with check (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plan_state.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  );
