-- Resolves which auth.users.id should receive a web push when a trainer saves a period plan.
-- Distinct from resolve_member_form_push_recipient, which returns the owning trainer (for form submissions).
-- Run in Supabase SQL editor. Callable only by service_role (Edge Functions).

create or replace function public.resolve_period_plan_push_recipient(p_member_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.members m
  inner join auth.users u on lower(trim(m.email)) = lower(trim(u.email))
  where m.id = trim(p_member_id)
    and m.is_active is distinct from false
  limit 1;
$$;

revoke all on function public.resolve_period_plan_push_recipient(text) from public;
grant execute on function public.resolve_period_plan_push_recipient(text) to service_role;
