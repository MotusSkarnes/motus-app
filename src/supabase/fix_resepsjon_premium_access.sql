-- Resepsjon som Premium-medlem: membership + auth role member (medlemsside, ikke PT-coach).
-- Kjør i Supabase SQL Editor etter at trener har satt Premium i appen.

update public.members
set
  membership_type = 'Premium',
  is_active = true
where lower(trim(email)) = 'resepsjon@motus-skarnes.no';

update auth.users u
set
  raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object('role', 'member', 'member_id', coalesce(u.id::text, u.raw_app_meta_data->>'member_id')),
  raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'member_id')
    || jsonb_build_object('role', 'member', 'member_id', coalesce(u.id::text, u.raw_user_meta_data->>'member_id'))
where lower(trim(u.email)) = 'resepsjon@motus-skarnes.no';

select m.id, m.email, m.membership_type, m.customer_type,
  u.raw_app_meta_data->>'role' as auth_role,
  u.raw_app_meta_data->>'member_id' as auth_member_id
from public.members m
full join auth.users u on lower(trim(u.email)) = lower(trim(m.email))
where lower(trim(coalesce(m.email, u.email))) = 'resepsjon@motus-skarnes.no';
