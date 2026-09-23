-- Members can archive/hide assigned programs via member_library_status.
-- training_programs_update_member_library previously allowed a full-row UPDATE,
-- so a member could wipe exercises, steal owner_user_id, or set
-- program_created_by = 'member' and then delete the trainer-assigned program.
--
-- This trigger keeps member sessions limited to member_library_status.
-- Trainer owners (auth.uid() = owner_user_id) and service-role/SQL-editor
-- sessions (auth.uid() is null) are unchanged.
--
-- Run in Supabase SQL Editor after training_programs_member_library_rls.sql.

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
