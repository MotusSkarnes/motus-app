-- Restrict inspiration_feed writes to trainers/staff.
-- Previous write policy used `using (true) with check (true)`, so any authenticated
-- user (including members) could wipe or replace the shared Utforsk feed and hero
-- row via PostgREST — bypassing the canManage UI gate.
-- Kjør i Supabase SQL Editor.

drop policy if exists "inspiration_feed_write_authenticated" on public.inspiration_feed;
create policy "inspiration_feed_write_authenticated"
  on public.inspiration_feed
  for all
  to authenticated
  using (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  )
  with check (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  );
