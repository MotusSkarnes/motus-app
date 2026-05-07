-- Strict RLS setup for authenticated users.
-- Run AFTER moving to Supabase Auth and validating owner mapping.

alter table public.members
  add column if not exists owner_user_id uuid default auth.uid();
update public.members set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.members alter column owner_user_id set not null;

alter table public.chat_messages
  add column if not exists owner_user_id uuid default auth.uid();
update public.chat_messages set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.chat_messages alter column owner_user_id set not null;

alter table public.training_programs
  add column if not exists owner_user_id uuid default auth.uid();
update public.training_programs set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.training_programs alter column owner_user_id set not null;

alter table public.workout_logs
  add column if not exists owner_user_id uuid default auth.uid();
update public.workout_logs set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.workout_logs alter column owner_user_id set not null;

drop policy if exists "members_select_dev" on public.members;
drop policy if exists "members_insert_dev" on public.members;
drop policy if exists "members_update_dev" on public.members;
create policy "members_select_own"
  on public.members
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (
      lower(trim(customer_type)) = 'medlem'
      and (
        auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
        or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
      )
    )
  );
create policy "members_insert_own"
  on public.members
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "members_update_own"
  on public.members
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "chat_messages_select_dev" on public.chat_messages;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_dev" on public.chat_messages;
create policy "chat_messages_select_trainer_or_member"
  on public.chat_messages
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.members m
      where m.id = chat_messages.member_id
        and m.owner_user_id = auth.uid()
    )
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "training_programs_select_dev" on public.training_programs;
drop policy if exists "training_programs_select_own" on public.training_programs;
drop policy if exists "training_programs_insert_dev" on public.training_programs;
drop policy if exists "training_programs_update_dev" on public.training_programs;
drop policy if exists "training_programs_delete_dev" on public.training_programs;
create policy "training_programs_select_trainer_or_member"
  on public.training_programs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "training_programs_insert_own"
  on public.training_programs
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "training_programs_update_own"
  on public.training_programs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "training_programs_delete_own"
  on public.training_programs
  for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "workout_logs_select_dev" on public.workout_logs;
drop policy if exists "workout_logs_select_own" on public.workout_logs;
drop policy if exists "workout_logs_insert_dev" on public.workout_logs;
drop policy if exists "workout_logs_update_dev" on public.workout_logs;
drop policy if exists "workout_logs_delete_dev" on public.workout_logs;
create policy "workout_logs_select_trainer_or_member"
  on public.workout_logs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "workout_logs_insert_own"
  on public.workout_logs
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "workout_logs_update_own"
  on public.workout_logs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "workout_logs_delete_own"
  on public.workout_logs
  for delete to authenticated
  using (owner_user_id = auth.uid());

-- member_period_plans (periodeplan for kunde, synk på tvers av enheter)
create table if not exists public.member_period_plans (
  member_id text not null,
  plan_id text not null,
  owner_user_id uuid not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  primary key (member_id, plan_id)
);

create index if not exists member_period_plans_owner_user_id_idx on public.member_period_plans (owner_user_id);

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
