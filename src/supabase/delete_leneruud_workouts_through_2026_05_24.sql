-- Sletter all treningsdata for leneruud@msn.com med øktdato <= 24.05.2026.
-- Logger fra 25.05.2026 og senere beholdes.
-- Renser også periodPlanCompletion-blokken i personal_goals slik at huk-av/skjul-status
-- ikke peker på slettede økter, og nullstiller days_since_activity.
--
-- Kjøres via:
--   supabase db query --linked --file src/supabase/delete_leneruud_workouts_through_2026_05_24.sql
-- eller direkte i Supabase SQL Editor.

-- 1) Slett workout_logs for leneruud@msn.com hvor parset dato (dd.MM.yyyy) <= 2026-05-24.
delete from public.workout_logs wl
where wl.member_id in (
    select m.id from public.members m
    where lower(trim(m.email)) = 'leneruud@msn.com'
  )
  and regexp_match(wl.date, '^(\d{1,2})\.(\d{1,2})\.(\d{4})') is not null
  and make_date(
        (regexp_match(wl.date, '^(\d{1,2})\.(\d{1,2})\.(\d{4})'))[3]::int,
        (regexp_match(wl.date, '^(\d{1,2})\.(\d{1,2})\.(\d{4})'))[2]::int,
        (regexp_match(wl.date, '^(\d{1,2})\.(\d{1,2})\.(\d{4})'))[1]::int
      ) <= date '2026-05-24';

-- 2) Rens periodPlanCompletion-blokken og nullstill days_since_activity.
-- (Klienten utleder fullførte økter fra workout_logs som blir igjen,
--  så en tom periodPlanCompletion gir helt fersk start uten gjenliggende
--  huk-av-/skjul-status fra slettede dager.)
update public.members m
set
  personal_goals = 'MOTUS_PROFILE_V1:' || (
    jsonb_set(
      substring(m.personal_goals from length('MOTUS_PROFILE_V1:') + 1)::jsonb
        - 'periodPlanCompletion',
      '{periodPlanCompletion}',
      jsonb_build_object(
        'version', 1,
        'completedEntryKeys', '[]'::jsonb,
        'dismissedEntryKeys', '[]'::jsonb,
        'updatedAt', (extract(epoch from now()) * 1000)::bigint
      ),
      true
    )
  )::text,
  days_since_activity = '0'
where lower(trim(m.email)) = 'leneruud@msn.com'
  and m.personal_goals like 'MOTUS_PROFILE_V1:%';

-- Verifiser etter kjøring:
-- select id, member_id, program_title, date from public.workout_logs
-- where member_id in (select id from public.members where lower(trim(email)) = 'leneruud@msn.com')
-- order by date desc;
--
-- select id, days_since_activity,
--   (substring(personal_goals from length('MOTUS_PROFILE_V1:') + 1)::jsonb -> 'periodPlanCompletion') as period_plan_completion
-- from public.members where lower(trim(email)) = 'leneruud@msn.com';
