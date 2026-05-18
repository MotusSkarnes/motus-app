-- Verifiser at ibenkrogseter@gmail.com er helt borte.
select 'auth.users' as tbl, count(*)::int as cnt
from auth.users u
where lower(trim(u.email)) = lower('ibenkrogseter@gmail.com')
union all
select 'members', count(*)::int
from public.members m
where lower(trim(m.email)) = lower('ibenkrogseter@gmail.com')
union all
select 'training_programs (email member_id)', count(*)::int
from public.training_programs tp
where lower(trim(tp.member_id)) = lower('ibenkrogseter@gmail.com')
union all
select 'training_programs (member-0eyzrab)', count(*)::int
from public.training_programs tp
where tp.member_id = 'member-0eyzrab'
union all
select 'workout_logs (email member_id)', count(*)::int
from public.workout_logs wl
where lower(trim(wl.member_id)) = lower('ibenkrogseter@gmail.com')
union all
select 'workout_logs (member-0eyzrab)', count(*)::int
from public.workout_logs wl
where wl.member_id = 'member-0eyzrab';
