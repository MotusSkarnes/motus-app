-- PT som eier medlemsraden skal få web push når medlem leverer oppstartsskjema / månedlig sjekk-inn.
-- Run in Supabase SQL editor. Callable only by service_role (Edge Functions).

create or replace function public.resolve_member_form_push_recipient(p_member_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.owner_user_id
  from public.members m
  where m.id = trim(p_member_id)
    and m.is_active is distinct from false
  limit 1;
$$;

revoke all on function public.resolve_member_form_push_recipient(text) from public;
grant execute on function public.resolve_member_form_push_recipient(text) to service_role;
