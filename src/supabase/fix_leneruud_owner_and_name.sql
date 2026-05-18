-- Lene Ruud (leneruud@msn.com): riktig navn, eier = lene@motus-skarnes.no (IKKE iben@motus-skarnes.no).
-- Kjør: npx supabase db query --linked -f src/supabase/fix_leneruud_owner_and_name.sql

begin;

update public.members
set
  name = 'Lene Ruud',
  email = lower('leneruud@msn.com'),
  customer_type = 'PT-kunde',
  membership_type = coalesce(nullif(trim(membership_type), ''), 'Premium'),
  is_active = true,
  owner_user_id = (
    select id from auth.users where lower(trim(email)) = lower('lene@motus-skarnes.no') limit 1
  )
where id = 'member-nmn08uu';

update public.members
set
  name = 'Emma Hansen',
  email = lower('emma@example.com'),
  is_active = false,
  owner_user_id = (
    select id from auth.users where lower(trim(email)) = lower('lene@motus-skarnes.no') limit 1
  )
where id = 'm1';

update public.training_programs
set owner_user_id = (select id from auth.users where lower(trim(email)) = lower('lene@motus-skarnes.no') limit 1)
where member_id = 'member-nmn08uu'
   or lower(trim(member_id)) = lower('leneruud@msn.com');

update public.workout_logs
set owner_user_id = (select id from auth.users where lower(trim(email)) = lower('lene@motus-skarnes.no') limit 1)
where member_id = 'member-nmn08uu'
   or lower(trim(member_id)) = lower('leneruud@msn.com');

update public.chat_messages
set owner_user_id = (select id from auth.users where lower(trim(email)) = lower('lene@motus-skarnes.no') limit 1)
where member_id = 'member-nmn08uu'
   or lower(trim(member_id)) = lower('leneruud@msn.com');

update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu'),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu')
where lower(trim(u.email)) = lower('leneruud@msn.com');

commit;
