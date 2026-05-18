-- Diagnose: kun eksplisitte e-poster / member-id (IKKE LIKE '%lene%' — ulike kunder).
select 'auth' as section, u.id::text, u.email, u.raw_app_meta_data->>'member_id' as member_id, u.raw_app_meta_data->>'role' as role
from auth.users u
where lower(trim(u.email)) in (
  lower('leneruud@msn.com'),
  lower('lene@motus-skarnes.no'),
  lower('iben@motus-skarnes.no'),
  lower('ibenkrogseter@gmail.com')
)
   or u.raw_app_meta_data->>'member_id' in ('m1', 'member-nmn08uu')
order by u.email;

select 'members' as section, m.id, m.name, m.email, m.owner_user_id::text, m.customer_type, m.is_active::text
from public.members m
where lower(trim(m.email)) in (
  lower('leneruud@msn.com'),
  lower('lene@motus-skarnes.no')
)
   or m.id in ('m1', 'm2', 'member-nmn08uu')
order by m.created_at;

select 'programs' as section, tp.member_id, count(*)::text as cnt
from public.training_programs tp
where tp.member_id in ('m1', 'member-nmn08uu')
   or lower(trim(tp.member_id)) = lower('leneruud@msn.com')
group by tp.member_id;
