-- Require roster ownership for chat_messages inserts.
-- Previous insert policy only checked owner_user_id = auth.uid(), so any
-- authenticated user who knows a member_id (including shared Medlem IDs visible
-- to other trainers) could forge trainer/member chat rows that both the real PT
-- and the member see via select policies — bypassing send-chat-message authz.
-- Kjør i Supabase SQL Editor.

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.members m
      where m.id = chat_messages.member_id
        and m.owner_user_id = auth.uid()
        and coalesce(m.is_active, true) is not false
    )
  );
