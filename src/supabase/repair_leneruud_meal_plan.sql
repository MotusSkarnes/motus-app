-- Matplan for Lene Ruud (leneruud@msn.com) — kanonisk member_id: member-nmn08uu
-- Kjør diagnose (steg 1–2), deretter reparasjon (steg 3–4) i Supabase SQL Editor.

-- 1) Alle member-rader og matplan
select m.id,
       m.name,
       m.email,
       m.owner_user_id::text,
       u.email as owner_auth_email,
       mp.updated_at,
       jsonb_array_length(coalesce(mp.days, '[]'::jsonb)) as day_count
from public.members m
left join auth.users u on u.id = m.owner_user_id
left join public.member_meal_plans mp on mp.member_id = m.id::text
where lower(trim(m.email)) = lower('leneruud@msn.com')
   or m.id = 'member-nmn08uu';

-- 2) Matvarer per member_id
select mp.member_id,
       mp.owner_user_id::text,
       mp.title,
       mp.updated_at,
       (
         select count(*)::int
         from jsonb_array_elements(coalesce(mp.days, '[]'::jsonb)) d(day),
              jsonb_array_elements(coalesce(day->'meals', '[]'::jsonb)) meal,
              jsonb_array_elements(coalesce(meal->'items', '[]'::jsonb)) item
       ) as food_item_count
from public.member_meal_plans mp
where mp.member_id in (
  select id::text from public.members where lower(trim(email)) = lower('leneruud@msn.com')
)
   or mp.member_id in ('m1', 'member-nmn08uu');

-- 3) Reparasjon: eier på matplan = eier på kanonisk member-rad
begin;

update public.member_meal_plans mp
set owner_user_id = m.owner_user_id
from public.members m
where m.id = 'member-nmn08uu'
  and mp.member_id in (
    select id::text from public.members where lower(trim(email)) = lower('leneruud@msn.com')
  )
  and mp.owner_user_id is distinct from m.owner_user_id;

-- 4) Kopier rikeste plan til member-nmn08uu (hvis plan ligger på m1 eller annen duplikat-id)
insert into public.member_meal_plans (member_id, owner_user_id, title, notes, days, targets, updated_at)
select
  'member-nmn08uu',
  coalesce(
    (select owner_user_id from public.members where id = 'member-nmn08uu' limit 1),
    src.owner_user_id
  ),
  src.title,
  src.notes,
  src.days,
  src.targets,
  greatest(src.updated_at, now())
from (
  select mp.*,
         (
           select count(*)::int
           from jsonb_array_elements(coalesce(mp.days, '[]'::jsonb)) d(day),
                jsonb_array_elements(coalesce(day->'meals', '[]'::jsonb)) meal,
                jsonb_array_elements(coalesce(meal->'items', '[]'::jsonb)) item
         ) as food_item_count
  from public.member_meal_plans mp
  where mp.member_id in (
    select id::text from public.members where lower(trim(email)) = lower('leneruud@msn.com')
  )
     or mp.member_id in ('m1', 'member-nmn08uu')
) src
where src.member_id <> 'member-nmn08uu'
  and src.food_item_count > 0
order by src.food_item_count desc, src.updated_at desc
limit 1
on conflict (member_id) do update set
  days = excluded.days,
  title = excluded.title,
  notes = excluded.notes,
  targets = excluded.targets,
  owner_user_id = excluded.owner_user_id,
  updated_at = excluded.updated_at
where excluded.days is not null
  and jsonb_array_length(coalesce(excluded.days, '[]'::jsonb)) > 0;

commit;

-- 5) Verifiser
select mp.member_id, mp.owner_user_id::text, mp.updated_at,
       jsonb_array_length(coalesce(mp.days, '[]'::jsonb)) as day_count,
       (
         select count(*)::int
         from jsonb_array_elements(coalesce(mp.days, '[]'::jsonb)) d(day),
              jsonb_array_elements(coalesce(day->'meals', '[]'::jsonb)) meal,
              jsonb_array_elements(coalesce(meal->'items', '[]'::jsonb)) item
       ) as food_item_count
from public.member_meal_plans mp
where mp.member_id = 'member-nmn08uu';

-- 6) Etter app-deploy: deploy edge-funksjon
--   supabase functions deploy fetch-trainer-member-meal-plan
