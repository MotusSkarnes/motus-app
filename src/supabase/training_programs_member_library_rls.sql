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

-- RLS cannot limit UPDATE to a single column. Without this trigger a member can
-- change exercises/owner/program_created_by (then delete trainer-assigned programs).
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
