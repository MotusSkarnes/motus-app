-- Diagnose: alle member-rader for ruudlene@gmail.com + data per rad

select
  m.id,
  m.name,
  m.email,
  m.is_active,
  m.created_at,
  m.owner_user_id::text,
  m.customer_type,
  count(distinct tp.id) as programs,
  count(distinct wl.id) as workout_logs,
  count(distinct cm.id) as chat_messages
from public.members m
left join public.training_programs tp on tp.member_id = m.id
left join public.workout_logs wl on wl.member_id = m.id
left join public.chat_messages cm on cm.member_id = m.id
where lower(trim(m.email)) = 'ruudlene@gmail.com'
group by m.id, m.name, m.email, m.is_active, m.created_at, m.owner_user_id, m.customer_type
order by programs desc, workout_logs desc, m.created_at desc;

select u.email, u.raw_app_meta_data->>'member_id' as auth_member_id
from auth.users u
where lower(trim(u.email)) = 'ruudlene@gmail.com';
