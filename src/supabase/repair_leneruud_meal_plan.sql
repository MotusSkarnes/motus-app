-- Matplan for leneruud@msn.com (kanonisk member_id: member-nmn08uu)
-- Kjør diagnose først. Hvis plan ligger på feil member_id, kopier til member-nmn08uu.

-- 1) Finn alle member-rader og matplan
select m.id, m.email, m.nutrition_access, mp.updated_at,
       jsonb_array_length(coalesce(mp.days, '[]'::jsonb)) as day_count
from public.members m
left join public.member_meal_plans mp on mp.member_id = m.id::text
where lower(trim(m.email)) = lower('leneruud@msn.com')
   or m.id = 'member-nmn08uu';

-- 2) Tell matvarer i plan (grovt)
select mp.member_id,
       (
         select count(*)::int
         from jsonb_array_elements(coalesce(mp.days, '[]'::jsonb)) d(day),
              jsonb_array_elements(coalesce(day->'meals', '[]'::jsonb)) meal,
              jsonb_array_elements(coalesce(meal->'items', '[]'::jsonb)) item
       ) as food_item_count
from public.member_meal_plans mp
where mp.member_id in (
  select id::text from public.members where lower(trim(email)) = lower('leneruud@msn.com')
);

-- 3) Kopier plan til member-nmn08uu hvis den ligger på annen id med mat
-- (uncomment og kjør manuelt etter du har sjekket diagnose)
--
-- insert into public.member_meal_plans (member_id, owner_user_id, title, notes, days, targets, updated_at)
-- select
--   'member-nmn08uu',
--   mp.owner_user_id,
--   mp.title,
--   mp.notes,
--   mp.days,
--   mp.targets,
--   now()
-- from public.member_meal_plans mp
-- where mp.member_id <> 'member-nmn08uu'
--   and mp.member_id in (select id::text from public.members where lower(trim(email)) = lower('leneruud@msn.com'))
-- on conflict (member_id) do update set
--   days = excluded.days,
--   title = excluded.title,
--   notes = excluded.notes,
--   targets = excluded.targets,
--   updated_at = excluded.updated_at;
