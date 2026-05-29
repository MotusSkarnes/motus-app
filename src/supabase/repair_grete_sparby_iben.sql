-- Gjenopprett Grete Sparby (gs@njf.no) for PT Iben (iben@motus-skarnes.no)

-- 1) Diagnose
select m.id, m.name, m.email, m.is_active, m.owner_user_id::text, m.customer_type, m.membership_type
from public.members m
where lower(trim(m.email)) = lower('gs@njf.no')
   or (lower(trim(m.name)) like '%grete%' and lower(trim(m.name)) like '%sparby%');

-- 2) Opprett eller reparer
insert into public.members (
  id,
  owner_user_id,
  name,
  email,
  is_active,
  customer_type,
  membership_type,
  invited_at,
  phone,
  birth_date,
  weight,
  height,
  level,
  days_since_activity,
  goal,
  focus,
  personal_goals,
  injuries,
  coach_notes
)
select
  'member-gsparby',
  (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1),
  'Grete Sparby',
  lower('gs@njf.no'),
  true,
  'PT-kunde',
  'Premium',
  now(),
  '',
  '',
  '',
  '',
  'Nybegynner',
  '0',
  '',
  '',
  '',
  '',
  ''
where not exists (
  select 1 from public.members where lower(trim(email)) = lower('gs@njf.no')
);

update public.members m
set
  owner_user_id = (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1),
  name = 'Grete Sparby',
  is_active = true,
  customer_type = 'PT-kunde',
  membership_type = coalesce(nullif(trim(m.membership_type), ''), 'Premium')
where lower(trim(m.email)) = lower('gs@njf.no');

-- 3) Koble eventuelle programmer/logs som pekte på e-post som member_id
update public.training_programs
set member_id = 'member-gsparby'
where lower(trim(member_id)) = lower('gs@njf.no')
  and owner_user_id = (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1);

update public.workout_logs
set member_id = 'member-gsparby'
where lower(trim(member_id)) = lower('gs@njf.no')
  and owner_user_id = (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1);

update public.chat_messages
set member_id = 'member-gsparby'
where lower(trim(member_id)) = lower('gs@njf.no')
  and owner_user_id = (select id from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no') limit 1);

-- 4) Verifiser
select id, name, email, is_active, owner_user_id::text, customer_type
from public.members
where lower(trim(email)) = lower('gs@njf.no');
