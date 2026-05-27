-- Konsolider periodeplan for leneruud@msn.com til kanonisk member_id (member-nmn08uu).
-- Kjør steg 1 (SELECT) først. Deretter 2–3. Verifiser med steg 4.

-- 1) Se alle rader
select
  mpp.member_id,
  m.email,
  mpp.plan_id,
  mpp.plan->>'title' as title,
  mpp.plan->>'trainerSavedAtIso' as trainer_saved_at,
  mpp.plan->>'createdAt' as plan_created_at,
  mpp.created_at as row_created_at
from public.member_period_plans mpp
left join public.members m on m.id = mpp.member_id
where lower(trim(m.email)) = lower('leneruud@msn.com')
   or mpp.member_id in ('m1', 'member-nmn08uu')
order by mpp.plan_id, mpp.created_at desc nulls last;

-- 2) Flytt planer fra demo-rad m1 til member-nmn08uu (når canonical finnes)
update public.member_period_plans mpp
set member_id = 'member-nmn08uu'
where mpp.member_id = 'm1'
  and exists (
    select 1
    from public.members m
    where m.id = 'member-nmn08uu'
      and lower(trim(m.email)) = lower('leneruud@msn.com')
  );

-- 3) Slett duplikater (samme plan_id på både m1 og member-nmn08uu)
delete from public.member_period_plans m1row
using public.member_period_plans canon
where m1row.member_id = 'm1'
  and canon.member_id = 'member-nmn08uu'
  and m1row.plan_id = canon.plan_id;

-- 4) Verifiser — forvent én rad per plan_id under member-nmn08uu
select member_id, plan_id, plan->>'title' as title, plan->>'trainerSavedAtIso' as saved_at
from public.member_period_plans
where member_id in ('m1', 'member-nmn08uu')
order by plan_id;

-- 5) (Valgfritt) Rett auth member_id hvis det fortsatt peker på m1
-- select raw_app_meta_data from auth.users where lower(trim(email)) = lower('leneruud@msn.com');
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--   || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu'),
--   raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', 'member', 'member_id', 'member-nmn08uu')
-- where lower(trim(email)) = lower('leneruud@msn.com');
