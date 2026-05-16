-- Diagnose medlemsrader og Auth for e-post (én kunde om gangen).
-- Kjør i Supabase SQL Editor.
--
-- VIKTIG: Flere rader med «Lene» / leneruud / lene@motus-skarnes osv. er ofte
-- FORSKJELLIGE testbrukere i Motus — IKKE duplikater av samme person.
-- Ikke slå sammen, ikke mass-arkiver på navn, og ikke endre e-post på flere rader
-- i én UPDATE. Behandle alltid én eksakt e-post (eller én member-id) om gangen.

-- ---------------------------------------------------------------------------
-- 1) Én spesifikk kunde (bytt e-post under)
-- ---------------------------------------------------------------------------
select
  id,
  name,
  lower(trim(email)) as email,
  is_active,
  customer_type,
  owner_user_id,
  left(coalesce(personal_goals, ''), 80) as personal_goals_preview,
  created_at
from public.members
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));

-- ---------------------------------------------------------------------------
-- 2) Samme e-post i Auth (innlogging) — members og auth.users er separate tabeller
-- ---------------------------------------------------------------------------
select id, email, created_at, last_sign_in_at
from auth.users
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));

-- Hvis (2) har rad men (1) er tom: opprett kunde i PT-app med den e-posten,
-- eller oppdater KUN én members-rad du vet hører til denne kunden (aldri testradene).

-- ---------------------------------------------------------------------------
-- 3) Oversikt test-/lene-relaterte medlemmer (kun lesing — ikke mass-endring)
-- ---------------------------------------------------------------------------
-- select id, name, email, is_active, customer_type, created_at
-- from public.members
-- where lower(trim(name)) like '%lene%'
--    or lower(trim(email)) like '%lene%'
-- order by email, created_at desc;

-- ---------------------------------------------------------------------------
-- 4) Data på én member-id (bytt id)
-- ---------------------------------------------------------------------------
-- select 'programs' as kind, count(*) from public.training_programs where member_id = '...'
-- union all
-- select 'logs', count(*) from public.workout_logs where member_id = '...'
-- union all
-- select 'messages', count(*) from public.chat_messages where member_id = '...';

-- ---------------------------------------------------------------------------
-- 5) Arkiver ÉN kunde (kun denne e-posten)
-- ---------------------------------------------------------------------------
-- update public.members
-- set is_active = false
-- where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));

-- ---------------------------------------------------------------------------
-- 6) Aktiver ÉN kunde igjen (kun denne e-posten) — eller bruk «Aktiver kunde igjen» i appen
-- ---------------------------------------------------------------------------
-- update public.members
-- set is_active = true
-- where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));
