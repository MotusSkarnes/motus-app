-- Lar innloggede medlemmer lagre øktlogg (f.eks. intervalløkt) med PT som owner_user_id.
-- Kjør i Supabase SQL Editor én gang, deretter upsert_member_workout_log_rpc.sql.

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
