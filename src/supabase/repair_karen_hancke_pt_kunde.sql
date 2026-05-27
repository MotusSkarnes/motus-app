-- Karen Hancke / karen@setergard.no
--
-- Auth kan vise member_id = member-zgj16le selv om raden ikke finnes i members
-- (slettet, feil miljø, eller aldri opprettet). Da «hopper» kundetype tilbake og innlogging feiler.
--
-- Kjør seksjon 1–3 først. Bruk id fra steg 1 i steg 4 (ikke gjett member_id).

-- ============================================================================
-- 1) Finn Karen på e-post eller navn (bruk dette — ikke bare member_id)
-- ============================================================================
select
  id,
  name,
  email,
  customer_type,
  membership_type,
  owner_user_id::text,
  is_active,
  created_at
from public.members
where lower(trim(email)) = lower('karen@setergard.no')
   or (lower(trim(name)) like '%karen%' and lower(trim(name)) like '%hancke%')
order by created_at desc;

-- ============================================================================
-- 2) Auth peker ofte på member_id — sammenlign med steg 1
-- ============================================================================
select
  id as auth_user_id,
  email,
  raw_app_meta_data->>'member_id' as app_member_id,
  raw_user_meta_data->>'member_id' as user_member_id
from auth.users
where lower(trim(email)) = lower('karen@setergard.no');

-- Finnes member_id i Auth men IKKE i members? → steg 3 (opprett rad) eller steg 4 (reparer peker)
-- OBS stavekontroll på id: member-zgj16le (bokstav l + tall 6), ikke member-zgj1nle

-- ============================================================================
-- 3) Sjekk om member-zgj16le finnes (valgfritt)
-- ============================================================================
select id, name, email, customer_type
from public.members
where id = 'member-zgj16le';

-- PT-eier (Lene): 5a8aa65c-f6fb-47ee-9f76-617e52db83aa

-- ============================================================================
-- 4a) REPAIR — sett PT-kunde for Karen (kjør etter steg 1 bekrefter rad)
-- ============================================================================
begin;

update public.members
set
  customer_type = 'PT-kunde',
  is_active = true,
  owner_user_id = '5a8aa65c-f6fb-47ee-9f76-617e52db83aa'::uuid
where lower(trim(email)) = lower('karen@setergard.no');

update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'member',
      'member_id', (select id from public.members where lower(trim(email)) = lower('karen@setergard.no') limit 1)
    ),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'member',
      'member_id', (select id from public.members where lower(trim(email)) = lower('karen@setergard.no') limit 1)
    )
where lower(trim(u.email)) = lower('karen@setergard.no');

select id, name, email, customer_type, membership_type, owner_user_id::text, is_active
from public.members
where lower(trim(email)) = lower('karen@setergard.no');

commit;
-- rollback;

-- ============================================================================
-- 4b) REPAIR når Auth har member_id men members er tom (opprett manglende rad)
-- ============================================================================
-- begin;
--
-- insert into public.members (
--   id, owner_user_id, name, email, is_active, customer_type, membership_type,
--   days_since_activity, level, phone, birth_date, weight, height, goal, focus,
--   personal_goals, injuries, coach_notes
-- )
-- select
--   'member-zgj16le',
--   '5a8aa65c-f6fb-47ee-9f76-617e52db83aa'::uuid,
--   'Karen Hancke',
--   lower('karen@setergard.no'),
--   true,
--   'PT-kunde',
--   'Standard',
--   '0',
--   'Nybegynner',
--   '', '', '', '', '', '', '', ''
-- where not exists (select 1 from public.members where id = 'member-zgj16le');
--
-- update auth.users u
-- set
--   raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'member', 'member_id', 'member-zgj16le'),
--   raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'member', 'member_id', 'member-zgj16le')
-- where lower(trim(u.email)) = lower('karen@setergard.no');
--
-- commit;
