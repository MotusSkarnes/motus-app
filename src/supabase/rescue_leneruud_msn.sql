-- Rescue: Lene Ruud (leneruud@msn.com) forsvant fra PT-liste / kan ikke logge inn.
-- Kjør SELECT-delen først i Supabase SQL Editor. Kjør UPDATE kun når id/e-post er bekreftet.
--
-- Vanlig årsak: members.email ble satt til lene@motus-skarnes.no (trener-e-post) ved en feil.
-- Da finnes raden fortsatt under member-nmn08uu / auth member_id, men ikke under leneruud@msn.com.

-- 1) Auth-bruker
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(trim(u.email)) = lower('leneruud@msn.com');

-- 2) Alle relevante member-rader
with iben as (
  select id as trainer_user_id
  from auth.users
  where lower(trim(email)) = lower('iben@motus-skarnes.no')
  limit 1
)
select
  m.id,
  m.name,
  m.email,
  m.owner_user_id,
  m.customer_type,
  m.membership_type,
  m.is_active,
  m.created_at,
  (select trainer_user_id from iben) as iben_user_id,
  count(distinct tp.id) as programs,
  count(distinct wl.id) as logs
from public.members m
left join public.training_programs tp on tp.member_id = m.id
left join public.workout_logs wl on wl.member_id = m.id
where
  lower(trim(m.email)) in (lower('leneruud@msn.com'), lower('lene@motus-skarnes.no'))
  or m.id in ('member-nmn08uu')
  or m.id = (
    select coalesce(
      u.raw_app_meta_data->>'member_id',
      u.raw_user_meta_data->>'member_id'
    )
    from auth.users u
    where lower(trim(u.email)) = lower('leneruud@msn.com')
    limit 1
  )
group by m.id, m.name, m.email, m.owner_user_id, m.customer_type, m.membership_type, m.is_active, m.created_at
order by m.created_at desc;

-- 3) Reparasjon (2026-05-15): Auth pekte på m1, men raden var overskrevet med emil.ringstad@icloud.com
-- og eier 5a8aa65c (lene@motus-skarnes.no) — derfor usynlig for iben@motus-skarnes.no.
--
-- update public.members
-- set
--   email = lower('leneruud@msn.com'),
--   name = 'Lene Ruud',
--   owner_user_id = (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1),
--   customer_type = 'PT-kunde',
--   membership_type = 'Premium',
--   is_active = true
-- where id = 'm1';
--
-- update auth.users u
-- set
--   raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'member', 'member_id', 'm1'),
--   raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'member', 'member_id', 'm1')
-- where lower(trim(u.email)) = lower('leneruud@msn.com');

-- 4) Verifiser
-- select id, name, email, owner_user_id, customer_type, is_active from public.members where id = 'm1';
