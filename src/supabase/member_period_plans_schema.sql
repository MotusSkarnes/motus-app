-- Periodeplaner synlige for medlem på tvers av enheter (Supabase).
-- Kjør i SQL Editor etter deploy av app-versjon som leser/skriver denne tabellen.

create table if not exists public.member_period_plans (
  member_id text not null,
  plan_id text not null,
  owner_user_id uuid not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  primary key (member_id, plan_id)
);

create index if not exists member_period_plans_owner_user_id_idx on public.member_period_plans (owner_user_id);
create index if not exists member_period_plans_plan_id_idx on public.member_period_plans (plan_id);

alter table public.member_period_plans enable row level security;

drop policy if exists "member_period_plans_select_trainer_or_member" on public.member_period_plans;
drop policy if exists "member_period_plans_insert_trainer" on public.member_period_plans;
drop policy if exists "member_period_plans_update_trainer" on public.member_period_plans;
drop policy if exists "member_period_plans_delete_trainer" on public.member_period_plans;

create policy "member_period_plans_select_trainer_or_member"
  on public.member_period_plans
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );

create policy "member_period_plans_insert_trainer"
  on public.member_period_plans
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "member_period_plans_update_trainer"
  on public.member_period_plans
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "member_period_plans_delete_trainer"
  on public.member_period_plans
  for delete to authenticated
  using (owner_user_id = auth.uid());
