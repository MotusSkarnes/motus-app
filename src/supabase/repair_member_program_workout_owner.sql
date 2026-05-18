-- Reparer programmer/økter der owner_user_id er medlemmets auth-id i stedet for PT.
-- Kjør diagnose først for leneruud@msn.com:

select m.id as member_id, m.name, m.email, m.owner_user_id::text as pt_owner,
  tp.id as program_id, tp.title, tp.program_created_by, tp.owner_user_id::text as program_owner
from public.members m
left join public.training_programs tp on tp.member_id = m.id
where lower(trim(m.email)) = 'leneruud@msn.com'
order by tp.created_at desc nulls last;

select wl.id, wl.program_title, wl.date, wl.status, wl.owner_user_id::text as log_owner
from public.members m
join public.workout_logs wl on wl.member_id = m.id
where lower(trim(m.email)) = 'leneruud@msn.com'
order by wl.created_at desc;

-- Reparer alle rader der owner_user_id ikke matcher medlemmets PT:
update public.training_programs tp
set owner_user_id = m.owner_user_id
from public.members m
where tp.member_id = m.id
  and m.owner_user_id is not null
  and (tp.owner_user_id is distinct from m.owner_user_id);

update public.workout_logs wl
set owner_user_id = m.owner_user_id
from public.members m
where wl.member_id = m.id
  and m.owner_user_id is not null
  and (wl.owner_user_id is distinct from m.owner_user_id);
