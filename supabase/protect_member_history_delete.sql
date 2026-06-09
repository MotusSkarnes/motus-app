create or replace function public.prevent_member_delete_with_history()
returns trigger
language plpgsql
as $$
begin
  if
    exists (select 1 from public.training_programs where member_id = old.id)
    or exists (select 1 from public.workout_logs where member_id = old.id)
    or exists (select 1 from public.chat_messages where member_id = old.id)
    or exists (select 1 from public.member_period_plans where member_id = old.id)
  then
    raise exception
      'Cannot delete member % because linked client history exists; archive with is_active=false instead.',
      old.id;
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_member_delete_with_history on public.members;

create trigger prevent_member_delete_with_history
before delete on public.members
for each row
execute function public.prevent_member_delete_with_history();
