-- Restrict members INSERT to trusted trainers/staff.
-- Tip `members_insert_own` only required owner_user_id = auth.uid(), so any
-- authenticated user (including invited customers) could PostgREST-insert a
-- roster row. Shared Medlem rows are visible to every trainer hydrate, and
-- same-email rows are merged into the victim member app.
--
-- Run in Supabase SQL Editor after review. create-trainer-member still uses
-- the service role and is unaffected.

drop policy if exists "members_insert_own" on public.members;

create policy "members_insert_own"
  on public.members
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
      or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
    )
  );
