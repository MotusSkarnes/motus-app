-- Messages table for Motus PT app.
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

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

alter table public.members enable row level security;

drop policy if exists "members_select_dev" on public.members;
create policy "members_select_dev"
  on public.members
  for select
  to anon, authenticated
  using (true);

drop policy if exists "members_insert_dev" on public.members;
create policy "members_insert_dev"
  on public.members
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "members_update_dev" on public.members;
create policy "members_update_dev"
  on public.members
  for update
  to anon, authenticated
  using (true)
  with check (true);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  sender text not null check (sender in ('trainer', 'member')),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

-- Development-friendly policies.
-- Tighten these policies after Auth + user mapping is in place.
drop policy if exists "chat_messages_select_dev" on public.chat_messages;
create policy "chat_messages_select_dev"
  on public.chat_messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists "chat_messages_insert_dev" on public.chat_messages;
create policy "chat_messages_insert_dev"
  on public.chat_messages
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  title text not null,
  goal text not null default '',
  notes text not null default '',
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.training_programs enable row level security;

drop policy if exists "training_programs_select_dev" on public.training_programs;
create policy "training_programs_select_dev"
  on public.training_programs
  for select
  to anon, authenticated
  using (true);

drop policy if exists "training_programs_insert_dev" on public.training_programs;
create policy "training_programs_insert_dev"
  on public.training_programs
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "training_programs_update_dev" on public.training_programs;
create policy "training_programs_update_dev"
  on public.training_programs
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "training_programs_delete_dev" on public.training_programs;
create policy "training_programs_delete_dev"
  on public.training_programs
  for delete
  to anon, authenticated
  using (true);

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

alter table public.workout_logs enable row level security;

drop policy if exists "workout_logs_select_dev" on public.workout_logs;
create policy "workout_logs_select_dev"
  on public.workout_logs
  for select
  to anon, authenticated
  using (true);

drop policy if exists "workout_logs_insert_dev" on public.workout_logs;
create policy "workout_logs_insert_dev"
  on public.workout_logs
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "workout_logs_update_dev" on public.workout_logs;
create policy "workout_logs_update_dev"
  on public.workout_logs
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "workout_logs_delete_dev" on public.workout_logs;
create policy "workout_logs_delete_dev"
  on public.workout_logs
  for delete
  to anon, authenticated
  using (true);
