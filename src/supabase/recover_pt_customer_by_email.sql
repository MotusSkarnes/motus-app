-- Nødgjenoppretting: PT-kunde som ikke vises i appen (én e-post om gangen).
-- Kjør i Supabase SQL Editor. Bytt e-post under.

-- 1) Finn alle rader (aktive og inaktive)
select id, name, email, is_active, owner_user_id, customer_type, created_at
from public.members
where lower(trim(email)) = lower(trim('lene.norex@gmail.com'))
order by created_at desc;

-- 2) Aktiver og knytt til PT (bytt owner_user_id til din auth.users.id for treneren)
-- update public.members
-- set is_active = true,
--     owner_user_id = 'PT-UUID-HER'::uuid
-- where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));

-- 3) Auth-bruker finnes, men members er tom?
-- select id, email from auth.users where lower(trim(email)) = lower(trim('lene.norex@gmail.com'));
-- Bruk «Gjenopprett klient» i PT-app etter deploy av restore-member (oppretter rad fra Auth).
