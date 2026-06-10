-- Fjerner user_metadata fra members_select_own (brukere kan endre det selv).
-- Medlem: JWT e-post eller app_metadata.member_id (serverstyrt).
-- PT ser egne kunder (owner_user_id) + delte Medlem-rader (app_metadata.role eller @motus-skarnes.no).
-- Kjør i Supabase SQL Editor.

drop policy if exists "members_select_own" on public.members;

create policy "members_select_own"
  on public.members
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (
      lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and is_active = true
    )
    or (
      id::text = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
      and is_active = true
    )
    or (
      lower(trim(customer_type)) = 'medlem'
      and lower(trim(coalesce(membership_type, ''))) <> 'premium'
      and (
        nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
        or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
      )
    )
  );
