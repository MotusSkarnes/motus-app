-- Kjør hvis du allerede har kjørt member_workout_log_save_setup.sql uten auth-id-støtte.
-- Legger til m.id = 'auth-' || auth.uid() for medlemmer med syntetisk klient-id.

drop policy if exists "workout_logs_insert_member" on public.workout_logs;
create policy "workout_logs_insert_member"
  on public.workout_logs for insert to authenticated
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  );

drop policy if exists "workout_logs_update_member" on public.workout_logs;
create policy "workout_logs_update_member"
  on public.workout_logs for update to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_id
        and (
          lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          or m.id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
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
        or m.id = nullif(trim(auth.jwt() -> 'user_metadata' ->> 'member_id'), '')
        or m.id = 'auth-' || auth.uid()::text
      )
  );
$$;
