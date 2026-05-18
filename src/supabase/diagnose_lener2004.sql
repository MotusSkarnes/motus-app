-- Diagnose lener2004@gmail.com
-- Kjør: npx supabase db query --linked -f src/supabase/diagnose_lener2004.sql

select 'auth.users' as section, u.id::text, u.email, u.created_at::text,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  u.raw_app_meta_data->>'role' as auth_role
from auth.users u
where lower(trim(u.email)) = 'lener2004@gmail.com';

select 'members_by_email' as section, m.id, m.email, m.name,
  m.is_active, m.owner_user_id::text, m.customer_type,
  left(coalesce(m.personal_goals, ''), 100) as goals_preview
from public.members m
where lower(trim(m.email)) = 'lener2004@gmail.com';

select 'members_by_auth_link' as section, m.id, m.email, m.name, m.is_active, m.owner_user_id::text
from auth.users u
join public.members m on m.id = coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
where lower(trim(u.email)) = 'lener2004@gmail.com';

select 'programs' as section, count(*)::bigint as cnt
from public.training_programs tp
where exists (
  select 1 from public.members m
  where lower(trim(m.email)) = 'lener2004@gmail.com'
    and (tp.member_id = m.id or lower(trim(tp.member_id)) = lower(trim(m.email)))
);

select 'logs' as section, count(*)::bigint as cnt
from public.workout_logs wl
where exists (
  select 1 from public.members m
  where lower(trim(m.email)) = 'lener2004@gmail.com'
    and (wl.member_id = m.id or lower(trim(wl.member_id)) = lower(trim(m.email)))
);

-- Ikke bruk LIKE '%lener%' — flere ulike kunder (lener2004, leneruud, lene.norex, ruudlene, …).
-- For oversikt over andre e-poster, kjør diagnose_member_by_email.sql med én target_email om gangen.
