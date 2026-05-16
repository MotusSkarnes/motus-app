-- Lene Ruud: ofte to medlemsrader (leneruud@msn.com + lene.norex@gmail.com).
-- Arkivering på én e-post påvirker ikke den andre raden.
-- Kjør i Supabase SQL Editor.

select
  id,
  name,
  lower(trim(email)) as email,
  is_active,
  customer_type,
  owner_user_id,
  invited_at,
  created_at
from public.members
where lower(trim(email)) in ('lene.norex@gmail.com', 'leneruud@msn.com')
   or lower(trim(name)) like '%lene%ruud%'
order by email, created_at desc;

-- Arkiver begge e-poster (kun hvis begge skal miste app-tilgang):
-- update public.members
-- set is_active = false
-- where lower(trim(email)) in ('lene.norex@gmail.com', 'leneruud@msn.com');

-- Gjenåpne begge (kun Admin/gjenopprett):
-- update public.members
-- set is_active = true
-- where lower(trim(email)) in ('lene.norex@gmail.com', 'leneruud@msn.com');
