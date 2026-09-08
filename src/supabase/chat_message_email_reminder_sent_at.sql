-- Stamp when an unread-message email reminder was sent (visible to trainers in chat UI).
-- Run in Supabase SQL Editor.

alter table public.chat_messages
  add column if not exists email_reminder_sent_at timestamptz;

create index if not exists chat_messages_email_reminder_sent_idx
  on public.chat_messages (email_reminder_sent_at)
  where email_reminder_sent_at is not null;

-- Backfill from existing reminder log (one reminder per message_id).
update public.chat_messages cm
set email_reminder_sent_at = r.sent_at
from public.chat_message_email_reminders r
where r.message_id = cm.id
  and cm.email_reminder_sent_at is null;

comment on column public.chat_messages.email_reminder_sent_at is
  'When an unread-chat email reminder was sent to the member for this trainer message.';
