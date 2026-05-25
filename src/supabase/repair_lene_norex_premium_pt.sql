-- Repair access level for lene.norex@gmail.com.
--
-- Reported problem:
--   lene.norex@gmail.com is described as both a Premium subscriber and a
--   PT-kunde, but the live app shows only the limited member feature set
--   (3 tabs: Hjem / Trening / Inspo). The limited UI is driven by
--   `isMemberLimited` in useRoleViewModel.ts — a member is limited when
--   *every* matching member row has customer_type='Medlem' AND
--   membership_type<>'Premium'.
--
-- Fix:
--   Set customer_type='PT-kunde' and membership_type='Premium' on the
--   member row(s) that belong to lene.norex@gmail.com. This will unlock
--   Fremgang + Meldinger tabs and all premium features on her next login
--   (or after a page reload that re-hydrates members).
--
-- Run SELECTs first to verify, then change `rollback;` to `commit;`.

begin;

-- 1) Inspect auth metadata.
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data->>'role' as app_role,
  u.raw_app_meta_data->>'member_id' as app_member_id,
  u.raw_user_meta_data->>'role' as user_role,
  u.raw_user_meta_data->>'member_id' as user_member_id
from auth.users u
where lower(u.email) = lower('lene.norex@gmail.com');

-- 2) Inspect member rows for that email.
select
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

-- 3) Upgrade matching member rows to PT-kunde + Premium.
update public.members
set
  customer_type = 'PT-kunde',
  membership_type = 'Premium',
  is_active = true
where lower(trim(email)) = lower('lene.norex@gmail.com');

-- 4) (Optional, only if auth user lacks linkage)
-- Pick the member_id you want to link her auth user to. Use the most
-- recent row from step 2 if there are multiple.
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'PASTE_MEMBER_ID'),
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--       || jsonb_build_object('role', 'member', 'member_id', 'PASTE_MEMBER_ID')
-- where lower(email) = lower('lene.norex@gmail.com');

-- 5) Verify final state.
select
  m.id,
  m.name,
  m.email,
  m.customer_type,
  m.membership_type,
  m.is_active
from public.members m
where lower(trim(m.email)) = lower('lene.norex@gmail.com')
order by m.created_at desc;

rollback;
