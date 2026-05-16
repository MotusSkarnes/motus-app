-- Medlem må kunne oppdatere member_library_status på programmer som er tildelt dem.
-- Uten dette feiler arkiver/skjul stille (kun owner_user_id = trener har update i dag).

drop policy if exists "training_programs_update_member_library" on public.training_programs;

create policy "training_programs_update_member_library"
  on public.training_programs
  for update to authenticated
  using (
    member_id is not null
    and (
      member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
      or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
      or lower(btrim(member_id)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    )
  )
  with check (
    member_id is not null
    and (
      member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
      or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
      or lower(btrim(member_id)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
