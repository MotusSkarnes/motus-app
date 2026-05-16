-- Arkiver alle medlemsrader for en e-post (kjør i Supabase SQL Editor).
-- Bytt e-post under.

select
  id,
  name,
  lower(trim(email)) as email,
  is_active,
  customer_type,
  owner_user_id,
  created_at
from public.members
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'))
order by created_at desc;

update public.members
set is_active = false, updated_at = now()
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));

select
  id,
  name,
  lower(trim(email)) as email,
  is_active
from public.members
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'))
order by created_at desc;
