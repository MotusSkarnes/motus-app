-- Resolves which auth.users.id should receive a web push for a chat_messages row.
-- trainer -> member: first auth user whose email matches public.members.email for that member_id.
-- member -> trainer: owner_user_id on the message.
-- Run in Supabase SQL editor. Callable only by service_role (Edge Functions).

create or replace function public.resolve_message_push_recipient(p_message_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select
    case c.sender
      when 'trainer' then (
        select u.id
        from auth.users u
        inner join public.members m on lower(trim(m.email)) = lower(trim(u.email))
        where m.id = c.member_id
        limit 1
      )
      else c.owner_user_id
    end
  from public.chat_messages c
  where c.id = p_message_id;
$$;

revoke all on function public.resolve_message_push_recipient(uuid) from public;
grant execute on function public.resolve_message_push_recipient(uuid) to service_role;
