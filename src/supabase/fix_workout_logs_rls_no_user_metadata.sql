-- Fjerner user_metadata fra workout_logs RLS-policies.
-- Medlem: app_metadata.member_id, e-postkobling i members, eller auth-{uid}.
-- PT: owner_user_id = auth.uid().
-- Kjør i Supabase SQL Editor.

drop policy if exists "workout_logs_select_trainer_or_member" on public.workout_logs;

create policy "workout_logs_select_trainer_or_member"
  on public.workout_logs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = workout_logs.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "workout_logs_insert_member" on public.workout_logs;

create policy "workout_logs_insert_member"
  on public.workout_logs
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  );

drop policy if exists "workout_logs_update_member" on public.workout_logs;

create policy "workout_logs_update_member"
  on public.workout_logs
  for update to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  );

drop policy if exists "workout_logs_delete_member_own" on public.workout_logs;

create policy "workout_logs_delete_member_own"
  on public.workout_logs
  for delete to authenticated
  using (
    member_id is not null
    and (
      member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
      or exists (
        select 1
        from public.members m
        where m.id = workout_logs.member_id
          and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          and coalesce(m.is_active, true) is not false
      )
    )
  );

create or replace function public.member_can_write_workout_log(p_member_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and (
        lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        or m.id = nullif(trim(auth.jwt() -> 'app_metadata' ->> 'member_id'), '')
        or m.id = 'auth-' || auth.uid()::text
      )
  );
$$;
