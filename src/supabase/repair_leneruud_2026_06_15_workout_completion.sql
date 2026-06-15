-- Repair leneruud@msn.com when "Helkropp styrke" still shows as completed on 15.06.2026.
--
-- Paste this whole file into Supabase SQL Editor and press Run.
--
-- What it does:
-- 1) Moves matching "Helkropp styrke" workout logs from 15.06.2026 to 14.06.2026.
-- 2) Clears periodPlanCompletion cache for Lene so the app derives completions from actual workout_logs.
-- 3) Prints a compact summary for verification.

with target_members as (
  select id
  from public.members
  where lower(trim(email)) = lower('leneruud@msn.com')
     or id in ('member-nmn08uu', 'm1')
),
moved_logs as (
  update public.workout_logs wl
  set date = case
    when wl.date ~ '^15\.06\.2026' then regexp_replace(wl.date, '^15\.06\.2026', '14.06.2026')
    when wl.date ~ '^2026-06-15' then regexp_replace(wl.date, '^2026-06-15', '2026-06-14')
    else wl.date
  end
  where wl.member_id in (select id from target_members)
    and wl.status = 'Fullført'
    and lower(wl.program_title) like '%helkropp%'
    and lower(wl.program_title) like '%styrke%'
    and (
      wl.date ilike '15.06.2026%'
      or wl.date ilike '2026-06-15%'
    )
  returning wl.id, wl.member_id, wl.program_title, wl.date, wl.status
),
cleared_completion_cache as (
  update public.members m
  set personal_goals = case
    when m.personal_goals like 'MOTUS_PROFILE_V1:%' then
      'MOTUS_PROFILE_V1:' || jsonb_set(
        substring(m.personal_goals from length('MOTUS_PROFILE_V1:') + 1)::jsonb,
        '{periodPlanCompletion}',
        jsonb_build_object(
          'version', 1,
          'completedEntryKeys', '[]'::jsonb,
          'dismissedEntryKeys', '[]'::jsonb,
          'updatedAt', floor(extract(epoch from clock_timestamp()) * 1000)
        ),
        true
      )::text
    else m.personal_goals
  end
  where m.id in (select id from target_members)
  returning m.id, m.email
),
remaining_logs as (
  select wl.id, wl.member_id, wl.program_title, wl.date, wl.status
  from public.workout_logs wl
  where wl.member_id in (select id from target_members)
    and (
      wl.date ilike '%14.06.2026%'
      or wl.date ilike '%15.06.2026%'
      or wl.date ilike '%2026-06-14%'
      or wl.date ilike '%2026-06-15%'
    )
)
select
  'moved_log' as section,
  id,
  member_id,
  program_title,
  date,
  status
from moved_logs
union all
select
  'remaining_log' as section,
  id,
  member_id,
  program_title,
  date,
  status
from remaining_logs
union all
select
  'cleared_completion_cache' as section,
  id,
  email as member_id,
  null::text as program_title,
  null::text as date,
  null::text as status
from cleared_completion_cache
order by section, date nulls last;
