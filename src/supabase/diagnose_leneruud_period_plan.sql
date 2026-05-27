-- Diagnose periodeplan for leneruud@msn.com — kjør hele filen, les resultatene.
-- Forventet kanonisk id: member-nmn08uu

-- A) Auth: hvilket member_id bruker innloggingen?
select
  u.email,
  u.raw_app_meta_data->>'member_id' as auth_member_id,
  u.raw_user_meta_data->>'member_id' as user_meta_member_id
from auth.users u
where lower(trim(u.email)) = lower('leneruud@msn.com');

-- B) Alle members-rader med denne e-posten
select id, name, email, is_active, customer_type, membership_type, created_at
from public.members
where lower(trim(email)) = lower('leneruud@msn.com')
   or id in ('m1', 'member-nmn08uu')
order by id;

-- C) Alle periodeplaner (sjekk member_id, plan_id, tittel, når PT sist lagret)
select
  mpp.member_id,
  m.email,
  mpp.plan_id,
  mpp.plan->>'title' as title,
  mpp.plan->>'trainerSavedAtIso' as trainer_saved_at,
  mpp.plan->>'createdAt' as plan_created_at,
  mpp.created_at as row_created_at,
  jsonb_array_length(coalesce(mpp.plan->'weeklyPlans', '[]'::jsonb)) as week_count
from public.member_period_plans mpp
left join public.members m on m.id = mpp.member_id
where lower(trim(m.email)) = lower('leneruud@msn.com')
   or mpp.member_id in ('m1', 'member-nmn08uu')
order by mpp.plan_id, mpp.created_at desc;

-- D) Antall rader per member_id (skal helst være 1 plan under member-nmn08uu, 0 under m1)
select member_id, count(*) as plan_count
from public.member_period_plans
where member_id in ('m1', 'member-nmn08uu')
   or member_id in (select id from public.members where lower(trim(email)) = lower('leneruud@msn.com'))
group by member_id
order by member_id;
