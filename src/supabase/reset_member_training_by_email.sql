-- Nullstill registrert trening + onboarding for én medlemse-post (førstegangsopplevelse).
-- Kjør i Supabase SQL Editor eller: npx supabase db query --linked -f src/supabase/reset_member_training_by_email.sql
-- Bytt e-post i _target_email under.

do $$
declare
  _target_email text := 'leneruud@msn.com';
  _member_id text;
  _deleted_logs int;
begin
  select u.raw_app_meta_data ->> 'member_id'
  into _member_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(_target_email))
  limit 1;

  if _member_id is null or trim(_member_id) = '' then
    select m.id into _member_id
    from public.members m
    where lower(trim(m.email)) = lower(trim(_target_email))
      and m.is_active = true
    order by m.created_at desc
    limit 1;
  end if;

  if _member_id is null then
    raise exception 'Ingen medlem funnet for e-post %', _target_email;
  end if;

  -- Slett logger på auth-koblet id og alle duplikat-rader med samme e-post (legacy m1, m2, …).
  delete from public.workout_logs wl
  where wl.member_id in (
    select m.id from public.members m
    where lower(trim(m.email)) = lower(trim(_target_email))
  );
  get diagnostics _deleted_logs = row_count;

  update public.members m
  set
    personal_goals = case
      when m.personal_goals like 'MOTUS_PROFILE_V1:%' then
        'MOTUS_PROFILE_V1:' || (
          (substring(m.personal_goals from length('MOTUS_PROFILE_V1:') + 1)::jsonb
            - 'onboarding'
            - 'onboardingCompletedAt'
          )::text
        )
      else m.personal_goals
    end,
    days_since_activity = '0'
  where m.id = _member_id;

  raise notice 'Reset for % (member_id=%): deleted % workout_logs, cleared onboarding',
    _target_email, _member_id, _deleted_logs;
end $$;

-- Verifiser etter kjøring:
-- select id, days_since_activity, left(personal_goals, 200) from public.members where id = 'member-nmn08uu';
-- select count(*) from public.workout_logs where member_id = 'member-nmn08uu';
