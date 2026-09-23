-- Restrict exercise_bank writes to trainers/staff.
-- Previous write policy used `using (true) with check (true)`, so any authenticated
-- user could insert/update/delete shared exercise-bank rows via PostgREST and poison
-- or empty the org-wide bank that trainers and members read.
-- Kjør i Supabase SQL Editor.

drop policy if exists "exercise_bank_write_authenticated" on public.exercise_bank;
create policy "exercise_bank_write_authenticated"
  on public.exercise_bank
  for all
  to authenticated
  using (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  )
  with check (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  );
