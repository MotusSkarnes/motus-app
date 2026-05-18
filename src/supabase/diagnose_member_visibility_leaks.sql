-- Audit member rows that can leak across trainers because email, owner_user_id,
-- customer_type, or auth member_id metadata is inconsistent.
--
-- Run in Supabase SQL editor. This file is read-only except the commented
-- repair examples at the bottom.

-- 1) Private rows without owner_user_id are risky: PT-kunde/Premium should be
-- tied to exactly one trainer.
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
where is_active is distinct from false
  and (
    lower(trim(customer_type)) in ('pt-kunde', 'oppfølging', 'oppfolging', 'egentrening')
    or lower(trim(membership_type)) = 'premium'
  )
  and owner_user_id is null
order by created_at desc;

-- 2) Same email used on rows owned by multiple trainers. This can be valid only
-- when the rows truly represent the same person; inspect before changing.
select
  lower(trim(email)) as email_key,
  count(*) as member_rows,
  count(distinct owner_user_id) filter (where owner_user_id is not null) as owner_count,
  array_agg(id order by created_at desc) as member_ids,
  array_agg(name order by created_at desc) as names,
  array_agg(customer_type order by created_at desc) as customer_types,
  array_agg(membership_type order by created_at desc) as membership_types,
  array_agg(coalesce(owner_user_id::text, 'null') order by created_at desc) as owner_ids
from public.members
where coalesce(trim(email), '') <> ''
  and is_active is distinct from false
group by lower(trim(email))
having count(*) > 1
order by owner_count desc, member_rows desc, email_key;

-- 3) Auth users whose member_id points to a member row with a different email.
select
  u.id as auth_user_id,
  u.email as auth_email,
  coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id') as auth_member_id,
  m.email as member_email,
  m.name as member_name,
  m.owner_user_id,
  m.customer_type,
  m.membership_type
from auth.users u
left join public.members m
  on m.id = coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
where coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id') is not null
  and m.id is not null
  and lower(trim(coalesce(u.email, ''))) <> lower(trim(coalesce(m.email, '')))
order by lower(u.email);

-- 4) Rows classified as Medlem. These are intentionally visible to all trainers
-- in the app. Inspect any that should actually be private.
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
where is_active is distinct from false
  and lower(trim(customer_type)) = 'medlem'
order by created_at desc;

-- Repair examples after inspection:
--
-- A) Make a wrongly shared row private to Iben:
-- update public.members
-- set customer_type = 'PT-kunde',
--     membership_type = 'Premium',
--     owner_user_id = (select id from auth.users where lower(email) = lower('iben@motus-skarnes.no'))
-- where id = 'TARGET_MEMBER_ID';
--
-- B) Fix an auth user's member_id after selecting the correct member row:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID'),
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'TARGET_MEMBER_ID')
-- where lower(email) = lower('member@example.com');
