-- Repair access level for lene.norex@gmail.com.
--
-- Symptom:
--   lene.norex@gmail.com er Premium + PT-kunde i virkeligheten, men PWA-en
--   viser kun den begrensede medlems-fanen (3 faner: Hjem / Trening / Inspo).
--
-- Limited-UI-regelen (src/features/MemberLayout.tsx:333-348 + duplikater):
--   For role='member' er hun "limited" hvis ALLE medlemsrader knyttet til
--   hennes session har customer_type='Medlem' OG membership_type<>'Premium'.
--   En eneste rad med PT-kunde ELLER Premium låser opp alle 5 fanene.
--
-- Forrige forsøk endte med 'rollback;' og kommenterte ut auth-oppgraderingen
-- — derfor gjorde det aldri noe i prod. Dette skriptet committer endringene
-- og oppdaterer auth-metadata i samme transaksjon.
--
-- BRUKES SLIK:
--   1) Kjør i Supabase SQL-editor (eller psql) med service-role tilgang.
--   2) Skriptet committer automatisk i siste steg.
--   3) Be Lene logge ut + inn igjen, eller tøm localStorage 'motus_pt_app_v2'
--      i nettleseren (PWA cacher members lokalt).
--
-- Etter at koden i d2a92fd1 + denne commit-en er live, vil klienten også
-- foretrekke sky-PT/Premium ved cache-konflikt.

begin;

-- ---------------------------------------------------------------------
-- 1) Pre-flight: vis hva som finnes nå (informativt; kjøres uansett).
-- ---------------------------------------------------------------------
select
  'auth (FØR)' as section,
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as app_role,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'role' as user_role,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(u.email) = lower('lene.norex@gmail.com');

select
  'members (FØR)' as section,
  m.id,
  m.name,
  m.email,
  m.owner_user_id,
  m.customer_type,
  m.membership_type,
  m.is_active,
  m.created_at
from public.members m
where lower(trim(m.email)) = lower('lene.norex@gmail.com')
order by m.created_at desc;

-- ---------------------------------------------------------------------
-- 2) Oppgradér ALLE matchende medlemsrader til PT-kunde + Premium + aktiv.
--    En enkelt slik rad er nok til å låse opp Fremgang/Meldinger.
-- ---------------------------------------------------------------------
update public.members
set
  customer_type = 'PT-kunde',
  membership_type = 'Premium',
  is_active = true
where lower(trim(email)) = lower('lene.norex@gmail.com');

-- ---------------------------------------------------------------------
-- 3) Sørg for at auth.users har role='member' og peker på en eksisterende
--    medlemsrad. Velger nyeste aktive rad.
-- ---------------------------------------------------------------------
with target_member as (
  select id
  from public.members
  where lower(trim(email)) = lower('lene.norex@gmail.com')
    and is_active is true
  order by created_at desc
  limit 1
)
update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', (select id from target_member)),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', (select id from target_member))
where lower(u.email) = lower('lene.norex@gmail.com')
  and exists (select 1 from target_member);

-- ---------------------------------------------------------------------
-- 4) Verifiser etter-tilstand.
-- ---------------------------------------------------------------------
select
  'auth (ETTER)' as section,
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as app_role,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'role' as user_role,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(u.email) = lower('lene.norex@gmail.com');

select
  'members (ETTER)' as section,
  m.id,
  m.name,
  m.email,
  m.customer_type,
  m.membership_type,
  m.is_active
from public.members m
where lower(trim(m.email)) = lower('lene.norex@gmail.com')
order by m.created_at desc;

commit;
