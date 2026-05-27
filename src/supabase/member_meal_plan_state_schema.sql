-- Medlemmets matplan-logging og bytter (synkes på tvers av enheter).
create table if not exists public.member_meal_plan_state (
  member_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.member_meal_plan_state enable row level security;

drop policy if exists "member_meal_plan_state_select" on public.member_meal_plan_state;
create policy "member_meal_plan_state_select"
  on public.member_meal_plan_state
  for select
  to authenticated
  using (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or member_id in (
      select m.id::text
      from public.members m
      where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    or exists (
      select 1
      from public.member_meal_plans mp
      where mp.member_id = member_meal_plan_state.member_id
        and mp.owner_user_id = auth.uid()
    )
  );

drop policy if exists "member_meal_plan_state_upsert_own" on public.member_meal_plan_state;
create policy "member_meal_plan_state_upsert_own"
  on public.member_meal_plan_state
  for all
  to authenticated
  using (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or member_id in (
      select m.id::text
      from public.members m
      where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  )
  with check (
    member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or member_id in (
      select m.id::text
      from public.members m
      where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );

comment on table public.member_meal_plan_state is 'Medlems logging (måltider/vann/handleliste) og måltidsbytter; state JSON.';
