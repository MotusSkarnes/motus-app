-- Repair PT/member auth split for Iben.
--
-- Problem pattern:
-- - iben@motus-skarnes.no is the PT auth user and must stay role=trainer.
-- - ibenkrogseter@gmail.com is the member auth user and should point to the
--   member row with that email.
--
-- Run SELECTs first. Keep rollback until verified, then change to commit.

begin;

-- 1) Inspect auth metadata for the two accounts.
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data,
  u.raw_user_meta_data
from auth.users u
where lower(u.email) in (lower('iben@motus-skarnes.no'), lower('ibenkrogseter@gmail.com'))
order by lower(u.email);

-- 2) Inspect member rows that may have been mixed.
select
  m.id,
  m.name,
  m.email,
  m.owner_user_id,
  m.customer_type,
  m.membership_type,
  m.is_active,
  m.created_at,
  count(distinct tp.id) as program_count,
  count(distinct wl.id) as workout_log_count,
  count(distinct cm.id) as message_count
from public.members m
left join public.training_programs tp on tp.member_id = m.id
left join public.workout_logs wl on wl.member_id = m.id
left join public.chat_messages cm on cm.member_id = m.id
where lower(trim(m.email)) in (lower('iben@motus-skarnes.no'), lower('ibenkrogseter@gmail.com'))
   or lower(trim(m.name)) like '%iben%'
group by m.id, m.name, m.email, m.owner_user_id, m.customer_type, m.membership_type, m.is_active, m.created_at
order by m.created_at desc;

-- 3) Restore the customer row email if it was overwritten by the PT address.
-- Applied 2026-05-18 on member-0eyzrab.
--
-- update public.members
-- set
--   email = lower('ibenkrogseter@gmail.com'),
--   name = 'Iben Krogseter',
--   owner_user_id = (select id from auth.users where lower(email) = lower('iben@motus-skarnes.no') limit 1),
--   customer_type = 'PT-kunde',
--   is_active = true
-- where id = 'member-0eyzrab';

-- 4) Restore PT auth role. This deliberately removes member_id from the PT
-- account so the app cannot route it as a member.
-- update auth.users
-- set raw_app_meta_data =
--       (coalesce(raw_app_meta_data, '{}'::jsonb) - 'member_id')
--       || jsonb_build_object('role', 'trainer'),
--     raw_user_meta_data =
--       (coalesce(raw_user_meta_data, '{}'::jsonb) - 'member_id')
--       || jsonb_build_object('role', 'trainer')
-- where lower(email) = lower('iben@motus-skarnes.no');

-- 5) Point member auth at the restored row (use member id from step 2).
-- update auth.users
-- set raw_app_meta_data =
--       coalesce(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'member-0eyzrab'),
--     raw_user_meta_data =
--       coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'member-0eyzrab')
-- where lower(email) = lower('ibenkrogseter@gmail.com');

-- Manual alternative:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID'),
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID')
-- where lower(email) = lower('ibenkrogseter@gmail.com');

-- 6) Verify final state.
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as app_role,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'role' as user_role,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(u.email) in (lower('iben@motus-skarnes.no'), lower('ibenkrogseter@gmail.com'))
order by lower(u.email);

rollback;
