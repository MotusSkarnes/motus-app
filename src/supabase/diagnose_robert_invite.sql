-- Diagnose invitasjon for robertarniharaldsson@gmail.com
-- Kjør: npx supabase db query --linked -f src/supabase/diagnose_robert_invite.sql

select 'auth.users' as source, u.id::text as id, u.email, u.created_at::text,
  u.email_confirmed_at::text as email_confirmed,
  u.last_sign_in_at::text as last_sign_in,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  u.raw_app_meta_data->>'role' as auth_role,
  u.raw_user_meta_data->>'member_id' as meta_member_id
from auth.users u
where lower(trim(u.email)) = 'robertarniharaldsson@gmail.com';

select 'members' as source, m.id, m.email, m.name, m.is_active::text, m.invited_at::text,
  m.owner_user_id::text, m.customer_type, m.membership_type
from public.members m
where lower(trim(m.email)) = 'robertarniharaldsson@gmail.com';
