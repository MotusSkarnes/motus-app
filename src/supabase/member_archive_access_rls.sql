-- Arkiverte kunder skal ikke lese egen rad via medlemsinnlogging (e-post / member_id).
-- PT ser fortsatt inaktive kunder via owner_user_id og delt Medlem-regel.

drop policy if exists "members_select_own" on public.members;

create policy "members_select_own"
  on public.members
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (
      lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
      and is_active = true
    )
    or (
      id::text = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'member_id',
        auth.jwt() -> 'user_metadata' ->> 'member_id'
      )
      and is_active = true
    )
    or (
      lower(trim(customer_type)) = 'medlem'
      and (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
        or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
      )
    )
  );
