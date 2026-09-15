-- Kjør i Supabase SQL Editor. Krever at training_groups_schema.sql allerede er kjørt.
-- Hindrer at et innlogget medlem (eller annen bruker) forfalsker PT-meldinger i gruppechat.
--
-- Gammel policy godtok insert når owner_user_id = auth.uid() og sender_role = 'trainer',
-- uten å sjekke at brukeren eier treningsgruppen. Gruppe-medlemmer ser alle meldinger
-- i gruppen, og UI viser sender_role/sender_name, så en forfalsket PT-melding når alle.

drop policy if exists "group_chat_messages_insert" on public.group_chat_messages;
create policy "group_chat_messages_insert"
  on public.group_chat_messages
  for insert
  to authenticated
  with check (
    (
      owner_user_id = auth.uid()
      and sender_role = 'trainer'
      and sender_member_id is null
      and exists (
        select 1
        from public.training_groups g
        where g.id = group_chat_messages.group_id
          and g.owner_user_id = auth.uid()
      )
    )
    or (
      sender_role = 'member'
      and sender_member_id is not null
      and exists (
        select 1
        from public.training_group_members gm
        where gm.group_id = group_chat_messages.group_id
          and gm.member_id = group_chat_messages.sender_member_id
          and (
            gm.member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
            or exists (
              select 1
              from public.members m
              where m.id = gm.member_id
                and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
                and coalesce(m.is_active, true) is not false
            )
          )
      )
    )
  );
