-- Stabilitets-sjekker for produksjon (kjør i Supabase SQL Editor).
-- Ingen data endres — kun diagnose.

-- ---------------------------------------------------------------------------
-- A) RLS: forventede select-policies finnes
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

-- Forventet: 3 rader. Hvis 0: kjør src/supabase/production_stability_patch.sql

-- ---------------------------------------------------------------------------
-- B) Duplikat-medlemmer (samme e-post, flere rader)
-- ---------------------------------------------------------------------------
select
  lower(trim(email)) as email_key,
  count(*) as member_rows,
  array_agg(id order by created_at desc) as member_ids
from public.members
where coalesce(trim(email), '') <> ''
group by lower(trim(email))
having count(*) > 1
order by member_rows desc;

-- ---------------------------------------------------------------------------
-- C) Auth-brukere med role=member uten member_id i metadata
-- ---------------------------------------------------------------------------
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data ->> 'role' as app_role,
  u.raw_app_meta_data ->> 'member_id' as app_member_id,
  u.raw_user_meta_data ->> 'member_id' as user_member_id
from auth.users u
where coalesce(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role') = 'member'
  and coalesce(
    nullif(trim(u.raw_app_meta_data ->> 'member_id'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'member_id'), '')
  ) is null
order by u.email;

-- ---------------------------------------------------------------------------
-- D) Medlem-rader uten matchende auth (invitert men ikke logget inn)
-- ---------------------------------------------------------------------------
select
  m.id,
  m.name,
  m.email,
  m.invited_at,
  m.is_active,
  m.owner_user_id
from public.members m
where coalesce(trim(m.email), '') <> ''
  and m.is_active is not false
  and not exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(m.email))
  )
order by m.created_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- E) Øvelsesbank: Rehab-kategori tilgjengelig
-- ---------------------------------------------------------------------------
select count(*) as rehab_exercise_count
from public.exercise_bank
where category = 'Rehab';

-- Hvis 0: kjør exercise_bank_add_mobilitet_rehab_category.sql + seed_rehab_exercises.sql
