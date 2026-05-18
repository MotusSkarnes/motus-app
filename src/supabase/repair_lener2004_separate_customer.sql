-- Skill lener2004@gmail.com fra ruudlene@gmail.com (ulike kunder, ulike e-poster).
-- Lim inn HELE filen i Supabase Dashboard → SQL Editor → Run.
-- (Ikke terminal-kommandoer — bare SQL under.)

-- 1) lener2004@gmail.com — egen kunde (medlemsrad opprettet 15. mai 2026)
update public.members
set
  email = 'lener2004@gmail.com',
  name = coalesce(nullif(trim(name), ''), 'Lene'),
  is_active = true
where id = 'member-5h53274';

update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'member-5h53274', 'role', 'member'),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'member-5h53274', 'role', 'member')
where lower(trim(u.email)) = 'lener2004@gmail.com';

-- 2) ruudlene@gmail.com — egen kunde (kanonisk rad fra mai; ikke member-5h53274)
update public.members
set is_active = true
where id = 'member-fcz9p8n';

update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'member-fcz9p8n', 'role', 'member'),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'member-fcz9p8n', 'role', 'member')
where lower(trim(u.email)) = 'ruudlene@gmail.com';

-- Verifisering
select 'auth' as kind, u.email, u.raw_app_meta_data->>'member_id' as member_id
from auth.users u
where lower(trim(u.email)) in ('lener2004@gmail.com', 'ruudlene@gmail.com')
order by u.email;

select 'member' as kind, m.id, m.email, m.name, m.is_active
from public.members m
where m.id in ('member-5h53274', 'member-fcz9p8n');
