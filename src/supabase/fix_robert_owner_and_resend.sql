-- Engangsfiks: Robert Arni Haraldsson — feil owner_user_id (satt til egen auth-id) + klar for ny invitasjon
-- Kjør i Supabase SQL Editor, deretter «Send invitasjon» på kunden i appen.

-- 1) Vis status
select m.id, m.email, m.name, m.owner_user_id, m.invited_at, m.customer_type,
  u.id::text as auth_user_id, u.email_confirmed_at
from public.members m
left join auth.users u on lower(trim(u.email)) = lower(trim(m.email))
where lower(trim(m.email)) = 'robertarniharaldsson@gmail.com';

-- 2) Sett owner til riktig PT (owner_user_id er NOT NULL i DB)
-- Bytt UUID under om en annen trener opprettet kunden (lene@motus-skarnes.no):
update public.members
set owner_user_id = '5a8aa65c-f6fb-47ee-9f76-617e52db83aa'
where lower(trim(email)) = 'robertarniharaldsson@gmail.com'
  and owner_user_id::text = (
    select id::text from auth.users where lower(trim(email)) = 'robertarniharaldsson@gmail.com' limit 1
  );

-- 3) Etter oppdatering (forventet: PT sin uuid, ikke kundens auth-id)
select id, email, owner_user_id, invited_at from public.members
where lower(trim(email)) = 'robertarniharaldsson@gmail.com';
