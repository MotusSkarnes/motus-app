-- Reparer Lene Ruud (leneruud@msn.com): kanonisk rad member-nmn08uu, demo m1 tilbakestilles.
-- Kjør: npx supabase db query --linked -f src/supabase/repair_leneruud_canonical_member.sql

begin;

update public.members
set
  email = lower('leneruud@msn.com'),
  name = 'Lene Ruud',
  customer_type = 'PT-kunde',
  membership_type = coalesce(nullif(trim(membership_type), ''), 'Premium'),
  is_active = true,
  owner_user_id = coalesce(
    (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1),
    owner_user_id
  )
where id = 'member-nmn08uu';

update public.members
set
  email = lower('emma@example.com'),
  name = 'Emma Hansen',
  is_active = false
where id = 'm1';

update public.training_programs set member_id = 'member-nmn08uu' where member_id = 'm1';
update public.workout_logs set member_id = 'member-nmn08uu' where member_id = 'm1';
update public.chat_messages set member_id = 'member-nmn08uu' where member_id = 'm1';
update public.member_period_plans set member_id = 'member-nmn08uu' where member_id = 'm1';

update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu'),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu')
where lower(trim(u.email)) = lower('leneruud@msn.com');

commit;
