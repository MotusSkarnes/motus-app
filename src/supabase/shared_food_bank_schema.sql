-- Felles matvarebank på tvers av PT-er (importerte/nedlastede matvarer).
-- Personlige favoritter/nylig brukt + egne/endrede matvarer ligger fortsatt per PT i trainer_food_bank.
create table if not exists public.shared_food_bank_items (
  id text primary key,
  item jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_food_bank_items enable row level security;

drop policy if exists "shared_food_bank_items_select_trainers" on public.shared_food_bank_items;
create policy "shared_food_bank_items_select_trainers"
  on public.shared_food_bank_items
  for select
  to authenticated
  using (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
  );

drop policy if exists "shared_food_bank_items_insert_trainers" on public.shared_food_bank_items;
create policy "shared_food_bank_items_insert_trainers"
  on public.shared_food_bank_items
  for insert
  to authenticated
  with check (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
  );

drop policy if exists "shared_food_bank_items_update_trainers" on public.shared_food_bank_items;
create policy "shared_food_bank_items_update_trainers"
  on public.shared_food_bank_items
  for update
  to authenticated
  using (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
  )
  with check (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
    or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
  );

comment on table public.shared_food_bank_items is 'Felles importerte matvarer (Matvaretabellen/USDA) som alle PT-er kan lese. item=FoodItem snapshot.';

