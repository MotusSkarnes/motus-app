-- Lest-kvittering på chat (én hake = sendt, to haker = lest av mottaker).
-- Kjør i Supabase SQL Editor.

alter table public.chat_messages
  add column if not exists read_by_member_at timestamptz;

alter table public.chat_messages
  add column if not exists read_by_trainer_at timestamptz;

create index if not exists chat_messages_member_unread_by_trainer_idx
  on public.chat_messages (member_id, created_at)
  where sender = 'member' and read_by_trainer_at is null;

create index if not exists chat_messages_member_unread_by_member_idx
  on public.chat_messages (member_id, created_at)
  where sender = 'trainer' and read_by_member_at is null;
