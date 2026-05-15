-- Resolves which auth.users.id should receive a web push when a trainer comments on a workout log.
-- workout_logs.id is text (app-generated ids), not uuid.
-- Run in Supabase SQL editor. Callable only by service_role (Edge Functions).

drop function if exists public.resolve_workout_comment_push_recipient(uuid);

create or replace function public.resolve_workout_comment_push_recipient(p_log_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.workout_logs w
  inner join public.members m on m.id = w.member_id
  inner join auth.users u on lower(trim(m.email)) = lower(trim(u.email))
  where w.id = trim(p_log_id)
  limit 1;
$$;

revoke all on function public.resolve_workout_comment_push_recipient(text) from public;
grant execute on function public.resolve_workout_comment_push_recipient(text) to service_role;
