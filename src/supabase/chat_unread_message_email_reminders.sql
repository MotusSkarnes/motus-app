-- Unread chat message email reminders (24h).
-- Run in Supabase SQL Editor.

create table if not exists public.chat_message_email_reminders (
  id bigserial primary key,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  member_id text not null,
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists chat_message_email_reminders_message_unique
  on public.chat_message_email_reminders (message_id);

create index if not exists chat_message_email_reminders_member_sent_idx
  on public.chat_message_email_reminders (member_id, sent_at desc);

alter table public.chat_message_email_reminders enable row level security;

drop policy if exists "chat_message_email_reminders_service_role_select" on public.chat_message_email_reminders;
create policy "chat_message_email_reminders_service_role_select"
  on public.chat_message_email_reminders
  for select
  to service_role
  using (true);

drop policy if exists "chat_message_email_reminders_service_role_insert" on public.chat_message_email_reminders;
create policy "chat_message_email_reminders_service_role_insert"
  on public.chat_message_email_reminders
  for insert
  to service_role
  with check (true);

create or replace function public.select_unread_message_email_reminder_candidates()
returns table (
  message_id uuid,
  member_id text,
  member_name text,
  member_email text,
  message_text text,
  message_created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with eligible as (
    select distinct on (cm.member_id)
      cm.id as message_id,
      cm.member_id,
      m.name as member_name,
      lower(trim(m.email)) as member_email,
      cm.text as message_text,
      cm.created_at as message_created_at
    from public.chat_messages cm
    join public.members m on m.id = cm.member_id
    where cm.sender = 'trainer'
      and cm.read_by_member_at is null
      and cm.created_at <= (now() - interval '24 hours')
      and m.is_active = true
      and coalesce(trim(m.email), '') <> ''
      and not exists (
        select 1
        from public.chat_message_email_reminders r
        where r.message_id = cm.id
      )
      and not exists (
        select 1
        from public.chat_message_email_reminders r_recent
        where r_recent.member_id = cm.member_id
          and r_recent.sent_at >= (now() - interval '24 hours')
      )
    order by cm.member_id, cm.created_at desc
  )
  select
    e.message_id,
    e.member_id,
    e.member_name,
    e.member_email,
    e.message_text,
    e.message_created_at
  from eligible e;
$$;

revoke all on function public.select_unread_message_email_reminder_candidates() from public;
grant execute on function public.select_unread_message_email_reminder_candidates() to service_role;

-- Optional scheduler (pg_cron + pg_net):
-- 1) deploy function:
--    supabase functions deploy send-unread-message-email-reminders
--
-- 2) set function secrets:
--    CHAT_REMINDER_SECRET=...
--    RESEND_API_KEY=...
--    REMINDER_EMAIL_FROM=Motus <hello@your-domain.no>
--    PUBLIC_APP_URL=https://motus-pt-app.vercel.app
--
-- 3) configure hourly cron (example):
-- select cron.schedule(
--   'send-unread-message-email-reminders-hourly',
--   '15 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<project-ref>.functions.supabase.co/send-unread-message-email-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-reminder-secret', '<same-secret-as-env>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

