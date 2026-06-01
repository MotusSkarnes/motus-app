-- Matplan per kunde (én rad per member_id, eid av PT).
create table if not exists public.member_meal_plans (
  member_id text primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Matplan',
  notes text not null default '',
  days jsonb not null default '[]'::jsonb,
  targets jsonb,
  updated_at timestamptz not null default now()
);

alter table public.member_meal_plans enable row level security;

drop policy if exists "member_meal_plans_select" on public.member_meal_plans;
create policy "member_meal_plans_select"
  on public.member_meal_plans
  for select
  to authenticated
  using (
    auth.uid() = owner_user_id
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or member_id in (
      select m.id::text
      from public.members m
      where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists "member_meal_plans_insert_own" on public.member_meal_plans;
create policy "member_meal_plans_insert_own"
  on public.member_meal_plans
  for insert
  to authenticated
  with check (auth.uid() = owner_user_id);

drop policy if exists "member_meal_plans_update_own" on public.member_meal_plans;
create policy "member_meal_plans_update_own"
  on public.member_meal_plans
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "member_meal_plans_delete_own" on public.member_meal_plans;
create policy "member_meal_plans_delete_own"
  on public.member_meal_plans
  for delete
  to authenticated
  using (auth.uid() = owner_user_id);

comment on table public.member_meal_plans is 'PT-matplan tildelt kunde; days = [{ label, meals: [{ name, items: [{ foodId, foodName, grams, nutritionPer100g }] }] }].';
