-- Diagnose + reparasjon: resepsjon@motus-skarnes.no vs ruudlene@gmail.com
-- For full fix, kjør: repair_resepsjon_ruudlene_separate_customers.sql

select u.id as auth_user_id, u.email as auth_email,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  m.id as member_id, m.email as member_email, m.name, m.owner_user_id::text, m.is_active
from auth.users u
left join public.members m on m.id = coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
where lower(trim(u.email)) in ('resepsjon@motus-skarnes.no', 'ruudlene@gmail.com')
order by u.email;

select id, email, name, owner_user_id::text, customer_type, is_active
from public.members
where id = 'member-fcz9p8n'
   or lower(trim(email)) in ('resepsjon@motus-skarnes.no', 'ruudlene@gmail.com')
order by email;
