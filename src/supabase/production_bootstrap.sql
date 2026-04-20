-- Production bootstrap for Motus PT app
-- Run this in Supabase SQL Editor when you want a single-shot setup:
-- 1) Creates/updates all required tables
-- 2) Enables strict owner-based RLS
-- 3) Backfills owner_user_id using OWNER_USER_ID below
--
-- IMPORTANT:
-- Replace OWNER_USER_ID with the trainer auth.users.id UUID before running.
-- Example query to find it:
--   select id, email from auth.users where email = 'lene@motus-skarnes.no';

create extension if not exists pgcrypto;

-- ---------- Core tables ----------

create table if not exists public.members (
  id text primary key,
  name text not null,
  email text not null,
  is_active boolean not null default true,
  invited_at timestamptz,
  phone text not null default '',
  birth_date text not null default '',
  weight text not null default '',
  height text not null default '',
  level text not null default 'Nybegynner',
  membership_type text not null default 'Standard',
  customer_type text not null default 'Oppfølging',
  days_since_activity text not null default '0',
  goal text not null default '',
  focus text not null default '',
  personal_goals text not null default '',
  injuries text not null default '',
  coach_notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.members add column if not exists is_active boolean not null default true;
alter table public.members add column if not exists invited_at timestamptz;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  sender text not null check (sender in ('trainer', 'member')),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  title text not null,
  goal text not null default '',
  notes text not null default '',
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id text primary key,
  member_id text not null,
  program_title text not null,
  date text not null,
  status text not null default 'Fullført',
  note text not null default '',
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Owner columns ----------

alter table public.members add column if not exists owner_user_id uuid;
alter table public.chat_messages add column if not exists owner_user_id uuid;
alter table public.training_programs add column if not exists owner_user_id uuid;
alter table public.workout_logs add column if not exists owner_user_id uuid;

-- Replace this UUID before running.
-- If left as-is, the update will simply affect 0 rows and NOT NULL will fail.
update public.members
set owner_user_id = 'OWNER_USER_ID'
where owner_user_id is null;

update public.chat_messages
set owner_user_id = 'OWNER_USER_ID'
where owner_user_id is null;

update public.training_programs
set owner_user_id = 'OWNER_USER_ID'
where owner_user_id is null;

update public.workout_logs
set owner_user_id = 'OWNER_USER_ID'
where owner_user_id is null;

alter table public.members alter column owner_user_id set not null;
alter table public.chat_messages alter column owner_user_id set not null;
alter table public.training_programs alter column owner_user_id set not null;
alter table public.workout_logs alter column owner_user_id set not null;

-- ---------- RLS ----------

alter table public.members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.training_programs enable row level security;
alter table public.workout_logs enable row level security;

-- Drop old dev/strict policies if they exist.
drop policy if exists "members_select_dev" on public.members;
drop policy if exists "members_insert_dev" on public.members;
drop policy if exists "members_update_dev" on public.members;
drop policy if exists "members_select_own" on public.members;
drop policy if exists "members_insert_own" on public.members;
drop policy if exists "members_update_own" on public.members;

drop policy if exists "chat_messages_select_dev" on public.chat_messages;
drop policy if exists "chat_messages_insert_dev" on public.chat_messages;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_own" on public.chat_messages;

drop policy if exists "training_programs_select_dev" on public.training_programs;
drop policy if exists "training_programs_insert_dev" on public.training_programs;
drop policy if exists "training_programs_update_dev" on public.training_programs;
drop policy if exists "training_programs_delete_dev" on public.training_programs;
drop policy if exists "training_programs_select_own" on public.training_programs;
drop policy if exists "training_programs_insert_own" on public.training_programs;
drop policy if exists "training_programs_update_own" on public.training_programs;
drop policy if exists "training_programs_delete_own" on public.training_programs;

drop policy if exists "workout_logs_select_dev" on public.workout_logs;
drop policy if exists "workout_logs_insert_dev" on public.workout_logs;
drop policy if exists "workout_logs_update_dev" on public.workout_logs;
drop policy if exists "workout_logs_delete_dev" on public.workout_logs;
drop policy if exists "workout_logs_select_own" on public.workout_logs;
drop policy if exists "workout_logs_insert_own" on public.workout_logs;
drop policy if exists "workout_logs_update_own" on public.workout_logs;
drop policy if exists "workout_logs_delete_own" on public.workout_logs;

-- Strict authenticated-owner policies.
create policy "members_select_own"
  on public.members
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "members_insert_own"
  on public.members
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "members_update_own"
  on public.members
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "chat_messages_select_own"
  on public.chat_messages
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "training_programs_select_own"
  on public.training_programs
  for select to authenticated
  using (owner_user_id = auth.uid());

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

create policy "workout_logs_select_own"
  on public.workout_logs
  for select to authenticated
  using (owner_user_id = auth.uid());

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
