-- Finn medlemmer som kan ha blitt overskrevet av navne-synk-buggen (Emil / emil.ringstad@icloud.com).
-- Kjør i Supabase Dashboard → SQL Editor (prosjekt: PT app).

-- 1) Riktig ny kunde (forventet)
select id, name, email, owner_user_id, customer_type, invited_at, created_at
from public.members
where lower(trim(email)) = 'emil.ringstad@icloud.com'
order by created_at desc;

-- 2) Andre rader som heter Emil men har feil e-post (sannsynlig skade)
select id, name, email, owner_user_id, customer_type, invited_at, created_at
from public.members
where lower(trim(name)) = 'emil'
  and lower(trim(email)) <> 'emil.ringstad@icloud.com'
order by created_at desc;

-- 3) Flere rader med samme e-post (duplikater)
select lower(trim(email)) as email, count(*) as cnt, array_agg(id order by created_at desc) as member_ids
from public.members
where lower(trim(email)) = 'emil.ringstad@icloud.com'
group by 1
having count(*) > 1;

-- 4) Retting (kjørt 2026-05-15): member-nmn08uu (Lene Ruud / leneruud@msn.com) hadde feil navn "emil".
-- update public.members
-- set name = 'Lene Ruud'
-- where id = 'member-nmn08uu'
--   and lower(trim(email)) = 'leneruud@msn.com'
--   and lower(trim(name)) = 'emil';
