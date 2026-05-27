-- Production stability patch (idempotent).
-- Kjør ÉN GANG i Supabase SQL Editor på produksjonsprosjektet.
-- Trygg å kjøre på nytt — drop/create policies og IF NOT EXISTS overalt.
--
-- Fikser typiske symptomer etter production_bootstrap uten full rls_strict:
--   • Medlem ser ingen programmer/økter/meldinger (RLS kun owner_user_id)
--   • PT ser ikke programmer på delte Medlem-kunder
--   • Rehab-kategori mangler i øvelsesbanken
--
-- Etter SQL: deploy Edge Functions (se DRIFT_STABILITY.md eller npm run supabase:deploy-core).

-- ---------------------------------------------------------------------------
-- 1) SELECT policies: trener ELLER medlem (inkl. delte Medlem-kunder)
-- ---------------------------------------------------------------------------

drop policy if exists "chat_messages_select_dev" on public.chat_messages;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_select_trainer_or_member" on public.chat_messages;
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
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
  );

drop policy if exists "training_programs_select_dev" on public.training_programs;
drop policy if exists "training_programs_select_own" on public.training_programs;
drop policy if exists "training_programs_select_trainer_or_member" on public.training_programs;
create policy "training_programs_select_trainer_or_member"
  on public.training_programs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = training_programs.member_id
        and lower(trim(m.customer_type)) = 'medlem'
        and lower(trim(coalesce(m.membership_type, ''))) <> 'premium'
        and (
          auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
          or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
        )
    )
  );

drop policy if exists "workout_logs_select_dev" on public.workout_logs;
drop policy if exists "workout_logs_select_own" on public.workout_logs;
drop policy if exists "workout_logs_select_trainer_or_member" on public.workout_logs;
create policy "workout_logs_select_trainer_or_member"
  on public.workout_logs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
  );

-- ---------------------------------------------------------------------------
-- 2) Øvelsesbank: Mobilitet + Rehab (for seed_rehab_exercises.sql)
-- ---------------------------------------------------------------------------

alter table public.exercise_bank
  drop constraint if exists exercise_bank_category_check;

alter table public.exercise_bank
  add constraint exercise_bank_category_check
  check (category in ('Styrke', 'Kondisjon', 'Mobilitet', 'Rehab', 'Uttøyning'));

-- ---------------------------------------------------------------------------
-- 3) Web Push-tabell (hvis ikke allerede opprettet)
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Verifiser at policies ble opprettet (skal returnere 3 rader)
-- ---------------------------------------------------------------------------

select
  c.relname as table_name,
  p.polname as policy_name
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('chat_messages', 'training_programs', 'workout_logs')
  and p.polname like '%trainer_or_member%'
order by c.relname;
