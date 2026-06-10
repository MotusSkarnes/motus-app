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
      or exists (
        select 1
        from public.members m
        where m.id = training_programs.member_id
          and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          and coalesce(m.is_active, true) is not false
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
