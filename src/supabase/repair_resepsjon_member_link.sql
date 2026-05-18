-- Diagnose resepsjon@motus-skarnes.no (feil kobling via auth member_id er vanlig årsak)

select u.id as auth_user_id, u.email as auth_email,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  m.id as member_id, m.email as member_email, m.name, m.owner_user_id::text, m.customer_type, m.is_active
from auth.users u
left join public.members m on m.id = coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
where lower(trim(u.email)) = 'resepsjon@motus-skarnes.no';

select id, email, name, owner_user_id::text, customer_type, is_active
from public.members
where lower(trim(email)) = 'resepsjon@motus-skarnes.no';
