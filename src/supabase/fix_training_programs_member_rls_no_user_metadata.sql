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

-- RLS cannot limit UPDATE to a single column. Freeze trainer-owned fields for
-- non-owner sessions so members cannot wipe/steal/delete assigned programs.
alter table public.training_programs add column if not exists member_library_status text;

create or replace function public.restrict_member_training_program_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_library_status text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if auth.uid() is null or auth.uid() is not distinct from old.owner_user_id then
    return new;
  end if;
  next_library_status := new.member_library_status;
  new := old;
  new.member_library_status := next_library_status;
  return new;
end;
$$;

drop trigger if exists training_programs_restrict_member_updates on public.training_programs;
create trigger training_programs_restrict_member_updates
  before update on public.training_programs
  for each row
  execute function public.restrict_member_training_program_updates();

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
