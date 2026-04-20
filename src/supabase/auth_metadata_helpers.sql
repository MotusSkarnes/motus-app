-- Helper script for auth metadata setup.
-- Run in Supabase SQL Editor with admin privileges.
-- Adjust emails/IDs before running.

-- 1) Example: set trainer role by email
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"trainer"}'::jsonb
where email = 'trainer@motus.no';

-- 2) Example: set member role + member_id by email
-- Replace MEMBER_ID_VALUE with real ID from public.members.id
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'member', 'member_id', 'MEMBER_ID_VALUE')
where email = 'emma@example.com';

-- 3) Optional: inspect metadata
select id, email, raw_app_meta_data
from auth.users
order by created_at desc;

-- 4) Backfill: map member role/member_id automatically by matching e-post in public.members
-- Useful for existing users created manually in Auth.
update auth.users as u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'member', 'member_id', m.id)
from public.members m
where lower(u.email) = lower(m.email);
