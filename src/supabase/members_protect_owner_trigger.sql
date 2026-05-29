-- Hindrer at members.owner_user_id endres når kunden har programmer/logger hos en annen PT.
-- Eksplisitt overføring skjer via reassign-member-owner (oppdaterer også tilknyttet data).

create or replace function public.prevent_member_owner_steal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.owner_user_id is not distinct from new.owner_user_id then
    return new;
  end if;

  if exists (
    select 1
    from public.training_programs tp
    where tp.member_id = new.id
      and tp.owner_user_id is not null
      and tp.owner_user_id is distinct from new.owner_user_id
  ) then
    raise exception
      'members.owner_user_id kan ikke endres: kunden har treningsprogram hos annen PT. Bruk overføring i appen.';
  end if;

  if exists (
    select 1
    from public.workout_logs wl
    where wl.member_id = new.id
      and wl.owner_user_id is not null
      and wl.owner_user_id is distinct from new.owner_user_id
  ) then
    raise exception
      'members.owner_user_id kan ikke endres: kunden har treningslogger hos annen PT. Bruk overføring i appen.';
  end if;

  return new;
end;
$$;

drop trigger if exists members_protect_owner_before_update on public.members;
create trigger members_protect_owner_before_update
  before update of owner_user_id on public.members
  for each row
  execute function public.prevent_member_owner_steal();
