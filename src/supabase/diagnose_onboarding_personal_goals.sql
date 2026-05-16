-- Diagnose oppstartsskjema (personal_goals) per e-post.
-- Kjør i Supabase SQL Editor. Bytt e-post under WHERE om nødvendig.

select
  id,
  name,
  lower(trim(email)) as email,
  customer_type,
  owner_user_id,
  left(coalesce(personal_goals, ''), 120) as personal_goals_preview,
  case
    when coalesce(personal_goals, '') like '%onboardingCompletedAt%' then 'har fullført-markør'
    when coalesce(personal_goals, '') like '%"onboarding"%' then 'har onboarding-json'
    else 'mangler skjema i personal_goals'
  end as onboarding_status,
  created_at
from public.members
where lower(trim(email)) in ('lene.norex@gmail.com', 'leneruud@msn.com')
order by email, created_at desc;
