-- Fjerner user_metadata fra chat_messages_select_trainer_or_member.
-- Medlem: app_metadata.member_id (serverstyrt) eller e-postkobling i members.
-- Kjør i Supabase SQL Editor.

drop policy if exists "chat_messages_select_trainer_or_member" on public.chat_messages;

create policy "chat_messages_select_trainer_or_member"
  on public.chat_messages
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.members m
      where m.id = chat_messages.member_id
        and m.owner_user_id = auth.uid()
    )
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = chat_messages.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  );
