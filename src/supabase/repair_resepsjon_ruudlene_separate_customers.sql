-- Skill resepsjon@motus-skarnes.no fra ruudlene@gmail.com (to separate kunder).
-- Kjør HELE filen i Supabase Dashboard → SQL Editor → Run.
--
-- Symptom: PT-søk på resepsjon@ viser medlemsrad med ruudlene@gmail.com fordi
-- auth.users.member_id peker på feil rad (ofte member-fcz9p8n).

-- ── 1) Lene / ruudlene@gmail.com — kanonisk rad member-fcz9p8n ──
update public.members
set
  email = 'ruudlene@gmail.com',
  name = coalesce(nullif(trim(name), ''), 'Lene'),
  is_active = true
where id = 'member-fcz9p8n';

update auth.users u
set
  raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object('role', 'member', 'member_id', 'member-fcz9p8n'),
  raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object('role', 'member', 'member_id', 'member-fcz9p8n')
where lower(trim(u.email)) = 'ruudlene@gmail.com';

-- ── 2) Resepsjon — egen medlemsrad (auth-bruker-id), ikke Lenes rad ──
insert into public.members (
  id,
  owner_user_id,
  name,
  email,
  is_active,
  membership_type,
  customer_type,
  days_since_activity,
  goal,
  focus,
  personal_goals,
  injuries,
  coach_notes
)
select
  u.id::text,
  coalesce(
    (select m.owner_user_id from public.members m where m.id = 'member-fcz9p8n' limit 1),
    u.id
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    'Resepsjon'
  ),
  'resepsjon@motus-skarnes.no',
  true,
  'Standard',
  'PT-kunde',
  '0',
  '',
  '',
  '',
  '',
  ''
from auth.users u
where lower(trim(u.email)) = 'resepsjon@motus-skarnes.no'
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  is_active = true,
  customer_type = excluded.customer_type,
  owner_user_id = coalesce(public.members.owner_user_id, excluded.owner_user_id);

update auth.users u
set
  raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object(
      'role', 'member',
      'member_id', u.id::text
    ),
  raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object(
      'role', 'member',
      'member_id', u.id::text
    )
where lower(trim(u.email)) = 'resepsjon@motus-skarnes.no';

-- ── 3) Verifisering ──
select
  'auth' as kind,
  u.email,
  u.raw_app_meta_data->>'member_id' as member_id,
  u.raw_app_meta_data->>'role' as role
from auth.users u
where lower(trim(u.email)) in ('resepsjon@motus-skarnes.no', 'ruudlene@gmail.com')
order by u.email;

select
  'member' as kind,
  m.id,
  m.email,
  m.name,
  m.is_active,
  m.owner_user_id::text
from public.members m
where m.id = 'member-fcz9p8n'
   or lower(trim(m.email)) in ('resepsjon@motus-skarnes.no', 'ruudlene@gmail.com')
order by m.email;
