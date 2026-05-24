-- Medlem kan slette egne program (program_created_by = member) og tilhørende øktlogg.
-- Uten dette forsvinner sletting kun lokalt på én enhet (owner_user_id er trenerens UUID).
-- Kjør også training_programs_member_library_rls.sql hvis arkiver/skjul ikke synker ennå.

drop policy if exists "training_programs_delete_member_created" on public.training_programs;

create policy "training_programs_delete_member_created"
  on public.training_programs
  for delete to authenticated
  using (
    lower(btrim(coalesce(program_created_by, ''))) = 'member'
    and member_id is not null
    and (
      member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
      or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
      or lower(btrim(member_id)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
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
      or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
      or lower(btrim(member_id)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
