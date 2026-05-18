-- Diagnose and repair the accidental email overwrite where a member row that
-- should be leneruud@msn.com was changed to lene@motus-skarnes.no.
--
-- Run the SELECT sections first in Supabase SQL editor. Only run the UPDATE
-- inside the transaction after verifying the target row id/name/owner.

begin;

-- 1) Find the trainer auth id for iben@motus-skarnes.no.
with trainer as (
  select id as trainer_user_id, email
  from auth.users
  where lower(email) = lower('iben@motus-skarnes.no')
)
select * from trainer;

-- 2) Inspect suspicious member rows owned by Iben or matching the two emails.
with trainer as (
  select id as trainer_user_id
  from auth.users
  where lower(email) = lower('iben@motus-skarnes.no')
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
  count(distinct tp.id) as program_count,
  count(distinct wl.id) as workout_log_count,
  count(distinct cm.id) as message_count
from public.members m
left join public.training_programs tp on tp.member_id = m.id
left join public.workout_logs wl on wl.member_id = m.id
left join public.chat_messages cm on cm.member_id = m.id
where
  lower(trim(m.email)) in (lower('leneruud@msn.com'), lower('lene@motus-skarnes.no'))
  or m.owner_user_id = (select trainer_user_id from trainer)
  or lower(trim(m.name)) like '%leneruud%'
  or lower(trim(m.name)) like '%lene%'
group by m.id, m.name, m.email, m.owner_user_id, m.customer_type, m.membership_type, m.is_active, m.created_at
order by m.created_at desc;

-- 2b) Inspect auth metadata. Verify that each auth user points at its own
-- member row, not another user's row.
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as app_role,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'role' as user_role,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(u.email) in (lower('leneruud@msn.com'), lower('lene@motus-skarnes.no'), lower('iben@motus-skarnes.no'))
order by lower(u.email);

-- 3) Repair: replace TARGET_MEMBER_ID with the member row that belongs to
-- leneruud@msn.com, not the row for the Motus trainer/admin user.
--
-- update public.members
-- set email = lower('leneruud@msn.com')
-- where id = 'TARGET_MEMBER_ID'
--   and owner_user_id = (
--     select id from auth.users where lower(email) = lower('iben@motus-skarnes.no')
--   )
--   and lower(trim(email)) = lower('lene@motus-skarnes.no');

-- 3b) Optional auth metadata repair after the member row is confirmed.
-- Replace TARGET_MEMBER_ID with the leneruud member row id.
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID'),
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID')
-- where lower(email) = lower('leneruud@msn.com');

-- 3c) Faster rescue if leneruud auth metadata still points to the correct
-- member row. Inspect 2b first. If app_member_id/user_member_id is a real row,
-- this restores email and Iben ownership on that exact row.
--
-- with target as (
--   select
--     coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id') as member_id,
--     (select id from auth.users where lower(email) = lower('iben@motus-skarnes.no')) as iben_user_id
--   from auth.users u
--   where lower(u.email) = lower('leneruud@msn.com')
-- )
-- update public.members m
-- set email = lower('leneruud@msn.com'),
--     owner_user_id = target.iben_user_id,
--     customer_type = case
--       when lower(trim(coalesce(m.customer_type, ''))) = 'medlem' then 'PT-kunde'
--       else m.customer_type
--     end,
--     membership_type = case
--       when coalesce(trim(m.membership_type), '') = '' then 'Premium'
--       else m.membership_type
--     end,
--     is_active = true
-- from target
-- where m.id = target.member_id
--   and target.member_id is not null
--   and target.iben_user_id is not null;

-- 4) Verify after uncommenting/running the UPDATE above.
select
  id,
  name,
  email,
  owner_user_id,
  customer_type,
  membership_type,
  is_active,
  created_at
from public.members
where lower(trim(email)) in (lower('leneruud@msn.com'), lower('lene@motus-skarnes.no'))
order by created_at desc;

-- Keep rollback while verifying. Change to commit after the result is correct.
rollback;
