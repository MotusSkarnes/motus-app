-- Require roster ownership for trainer-style inserts on member child tables.
-- Previous insert policies only checked owner_user_id = auth.uid(), so any
-- authenticated user who knows a member_id (including shared Medlem IDs visible
-- to other trainers) could inject programs, workout logs, or period plans that
-- members (and Medlem-visible trainers) see via select policies.
-- Templates use member_id = '__template__' and have no members row — keep that path.
-- Kjør i Supabase SQL Editor.

drop policy if exists "training_programs_insert_own" on public.training_programs;
create policy "training_programs_insert_own"
  on public.training_programs
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      member_id = '__template__'
      or exists (
        select 1
        from public.members m
        where m.id = training_programs.member_id
          and m.owner_user_id = auth.uid()
          and coalesce(m.is_active, true) is not false
      )
    )
  );

drop policy if exists "training_programs_update_own" on public.training_programs;
create policy "training_programs_update_own"
  on public.training_programs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and (
      member_id = '__template__'
      or exists (
        select 1
        from public.members m
        where m.id = training_programs.member_id
          and m.owner_user_id = auth.uid()
          and coalesce(m.is_active, true) is not false
      )
    )
  );

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own"
  on public.workout_logs
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.members m
      where m.id = workout_logs.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "workout_logs_update_own" on public.workout_logs;
create policy "workout_logs_update_own"
  on public.workout_logs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.members m
      where m.id = workout_logs.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "member_period_plans_insert_trainer" on public.member_period_plans;
create policy "member_period_plans_insert_trainer"
  on public.member_period_plans
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.members m
      where m.id = member_period_plans.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "member_period_plans_update_trainer" on public.member_period_plans;
create policy "member_period_plans_update_trainer"
  on public.member_period_plans
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.members m
      where m.id = member_period_plans.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );
