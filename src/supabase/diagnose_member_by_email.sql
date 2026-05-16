-- Finn medlemsrader for en e-post (f.eks. savnet klient i PT-listen).
-- Kjør i Supabase SQL Editor. Bytt e-post i WHERE om nødvendig.

select
  id,
  name,
  lower(trim(email)) as email,
  is_active,
  invited_at,
  customer_type,
  membership_type,
  owner_user_id,
  created_at
from public.members
where lower(trim(email)) = lower(trim('emil.ringstad@icloud.com'))
order by created_at desc;

-- Flere rader med samme e-post?
select
  lower(trim(email)) as email_key,
  count(*) as row_count,
  array_agg(id order by created_at desc) as member_ids,
  array_agg(is_active order by created_at desc) as active_flags
from public.members
where lower(trim(email)) = lower(trim('emil.ringstad@icloud.com'))
group by lower(trim(email));

-- Aktiver alle inaktive rader for e-posten (kun om diagnose viser is_active = false):
-- update public.members
-- set is_active = true
-- where lower(trim(email)) = lower(trim('emil.ringstad@icloud.com'))
--   and is_active = false;
