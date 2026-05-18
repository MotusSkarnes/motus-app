-- Diagnose: finn medlem, auth og relatert data for én e-post
-- Kjør: npx supabase db query --linked -f src/supabase/diagnose_member_by_email.sql
-- Endre e-post under:

\set target_email 'lener2004@gmail.com'

select 'auth.users' as source, u.id::text as id, u.email, u.created_at::text,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  u.raw_app_meta_data->>'role' as auth_role
from auth.users u
where lower(trim(u.email)) = lower(trim(:'target_email'));

select 'members' as source, m.id, m.email, m.name, m.is_active::text, m.owner_user_id::text,
  m.customer_type, left(coalesce(m.personal_goals, ''), 80) as personal_goals_preview
from public.members m
where lower(trim(m.email)) = lower(trim(:'target_email'))
   or m.id in (
     select coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
     from auth.users u
     where lower(trim(u.email)) = lower(trim(:'target_email'))
   );

select 'programs' as source, count(*)::text as count
from public.training_programs tp
where lower(trim(tp.member_id)) in (
  select lower(trim(m.id)) from public.members m where lower(trim(m.email)) = lower(trim(:'target_email'))
)
or lower(trim(tp.member_id)) = lower(trim(:'target_email'));

select 'workout_logs' as source, count(*)::text as count
from public.workout_logs wl
where lower(trim(wl.member_id)) in (
  select lower(trim(m.id)) from public.members m where lower(trim(m.email)) = lower(trim(:'target_email'))
)
or lower(trim(wl.member_id)) = lower(trim(:'target_email'));

-- Ikke list «lignende» e-poster med LIKE — f.eks. leneruud, lener2004 og ruudlene er ulike kunder.
