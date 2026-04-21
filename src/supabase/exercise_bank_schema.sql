create table if not exists public.exercise_bank (
  id text primary key,
  name text not null,
  category text not null check (category in ('Styrke', 'Kondisjon', 'Uttøyning')),
  muscle_group text not null default '',
  equipment text not null default '',
  level text not null check (level in ('Nybegynner', 'Litt øvet', 'Øvet')),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exercise_bank enable row level security;

drop policy if exists "exercise_bank_read_authenticated" on public.exercise_bank;
create policy "exercise_bank_read_authenticated"
  on public.exercise_bank
  for select
  to authenticated
  using (true);

drop policy if exists "exercise_bank_write_authenticated" on public.exercise_bank;
create policy "exercise_bank_write_authenticated"
  on public.exercise_bank
  for all
  to authenticated
  using (true)
  with check (true);
