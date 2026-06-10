-- Fjerner user_metadata fra training_programs_update_member_library og training_programs_delete_member_created.
-- Medlem: app_metadata.member_id (serverstyrt) eller e-postkobling i members.
-- Kjør i Supabase SQL Editor.

drop policy if exists "training_programs_update_member_library" on public.training_programs;

create policy "training_programs_update_member_library"
  on public.training_programs
  for update to authenticated
  using (
    member_id is not null
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
  )
  with check (
    member_id is not null
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
