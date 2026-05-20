-- Én fil for intervalløkt-lagring: kjør HELE denne i Supabase SQL Editor (én gang).
-- Inkluderer RLS for workout_logs + RPC upsert_member_workout_log.

-- === 1) RLS: medlem kan insert/update egne øktlogger med PT som owner ===
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
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
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
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
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
          or m.id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
          or m.id = 'auth-' || auth.uid()::text
        )
    )
  );

-- === 2) RPC: sikker upsert uten å vente på treg edge ===
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

revoke all on function public.member_can_write_workout_log(text) from public;
grant execute on function public.member_can_write_workout_log(text) to authenticated;

create or replace function public.upsert_member_workout_log(
  p_id text,
  p_member_id text,
  p_owner_user_id uuid,
  p_program_title text,
  p_date text,
  p_status text,
  p_note text default '',
  p_results jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.member_can_write_workout_log(p_member_id) then
    return jsonb_build_object('ok', false, 'error', 'Ikke tilgang til å lagre økt for dette medlemmet.');
  end if;
  if p_owner_user_id is null or p_owner_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Kunne ikke finne trener-eier for økten.');
  end if;

  insert into public.workout_logs (
    id,
    member_id,
    owner_user_id,
    program_title,
    date,
    status,
    note,
    results,
    created_at
  )
  values (
    p_id,
    p_member_id,
    p_owner_user_id,
    p_program_title,
    p_date,
    coalesce(nullif(trim(p_status), ''), 'Fullført'),
    coalesce(p_note, ''),
    coalesce(p_results, '[]'::jsonb),
    now()
  )
  on conflict (id) do update set
    member_id = excluded.member_id,
    owner_user_id = excluded.owner_user_id,
    program_title = excluded.program_title,
    date = excluded.date,
    status = excluded.status,
    note = excluded.note,
    results = excluded.results;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.upsert_member_workout_log(text, text, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.upsert_member_workout_log(text, text, uuid, text, text, text, text, jsonb) to authenticated;
