-- Aktiver kosthold/ernæring for Lene Ruud (leneruud@msn.com) på alle member-rader med denne e-posten.
-- Kjør diagnose først, deretter UPDATE.

select
  id,
  name,
  email,
  customer_type,
  nutrition_access,
  owner_user_id::text,
  is_active
from public.members
where lower(trim(email)) = lower('leneruud@msn.com')
   or id in (
     select coalesce(
       u.raw_app_meta_data->>'member_id',
       u.raw_user_meta_data->>'member_id'
     )
     from auth.users u
     where lower(trim(u.email)) = lower('leneruud@msn.com')
   )
order by created_at;

-- begin;
-- update public.members
-- set nutrition_access = true
-- where lower(trim(email)) = lower('leneruud@msn.com')
--    or id in (
--      select coalesce(
--        u.raw_app_meta_data->>'member_id',
--        u.raw_user_meta_data->>'member_id'
--      )
--      from auth.users u
--      where lower(trim(u.email)) = lower('leneruud@msn.com')
--    );
--
-- select id, name, email, nutrition_access, is_active
-- from public.members
-- where lower(trim(email)) = lower('leneruud@msn.com');
-- commit;
