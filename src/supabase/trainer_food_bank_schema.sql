-- PT-spesifikk matvarebank (varer, favoritter, nylig brukt) synket på tvers av enheter.
create table if not exists public.trainer_food_bank (
  owner_user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  favorite_ids jsonb not null default '[]'::jsonb,
  recent_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.trainer_food_bank enable row level security;

drop policy if exists "trainer_food_bank_select_own" on public.trainer_food_bank;
create policy "trainer_food_bank_select_own"
  on public.trainer_food_bank
  for select
  to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "trainer_food_bank_insert_own" on public.trainer_food_bank;
create policy "trainer_food_bank_insert_own"
  on public.trainer_food_bank
  for insert
  to authenticated
  with check (auth.uid() = owner_user_id);

drop policy if exists "trainer_food_bank_update_own" on public.trainer_food_bank;
create policy "trainer_food_bank_update_own"
  on public.trainer_food_bank
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "trainer_food_bank_delete_own" on public.trainer_food_bank;
create policy "trainer_food_bank_delete_own"
  on public.trainer_food_bank
  for delete
  to authenticated
  using (auth.uid() = owner_user_id);
