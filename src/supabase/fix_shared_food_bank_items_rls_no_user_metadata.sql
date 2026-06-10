-- Fjerner user_metadata fra shared_food_bank_items PT-policies.
-- PT: app_metadata.role = trainer eller @motus-skarnes.no e-post.
-- Kjør i Supabase SQL Editor.

drop policy if exists "shared_food_bank_items_select_trainers" on public.shared_food_bank_items;

create policy "shared_food_bank_items_select_trainers"
  on public.shared_food_bank_items
  for select to authenticated
  using (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  );

drop policy if exists "shared_food_bank_items_insert_trainers" on public.shared_food_bank_items;

create policy "shared_food_bank_items_insert_trainers"
  on public.shared_food_bank_items
  for insert to authenticated
  with check (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  );

drop policy if exists "shared_food_bank_items_update_trainers" on public.shared_food_bank_items;

create policy "shared_food_bank_items_update_trainers"
  on public.shared_food_bank_items
  for update to authenticated
  using (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  )
  with check (
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
  );
