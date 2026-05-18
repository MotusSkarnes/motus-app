-- Merge duplikat-rader med NØYAKTIG e-post ruudlene@gmail.com inn i member-fcz9p8n.
-- Kjør: npx supabase db query --linked -f src/supabase/repair_ruudlene_duplicate_members.sql
--
-- VIKTIG: Ikke bruk dette skriptet for andre «lene»-e-poster (leneruud@msn.com, lene.norex@gmail.com,
-- lener2004@gmail.com, lene@motus-skarnes.no osv.) — det er separate kunder.
-- Appen og dedupe-members slår kun sammen rader med identisk full e-post, aldri delstreng.
--
-- Beholder én aktiv rad; flytter programmer, logger og chat; deaktiverer resten.

do $$
declare
  v_email text := 'ruudlene@gmail.com';
  v_canonical text := 'member-fcz9p8n';
  v_moved_programs int := 0;
  v_moved_logs int := 0;
  v_moved_messages int := 0;
  v_moved_period_plans int := 0;
  v_deactivated int := 0;
begin
  if not exists (select 1 from public.members where id = v_canonical) then
    raise exception 'Kanonisk rad % finnes ikke', v_canonical;
  end if;

  update public.members
  set
    email = v_email,
    name = coalesce(nullif(trim(name), ''), 'Lene'),
    is_active = true
  where id = v_canonical;

  update public.training_programs
  set member_id = v_canonical
  where member_id in (
    select id from public.members where lower(trim(email)) = v_email and id <> v_canonical
  )
     or lower(trim(member_id)) = v_email;
  get diagnostics v_moved_programs = row_count;

  update public.workout_logs
  set member_id = v_canonical
  where member_id in (
    select id from public.members where lower(trim(email)) = v_email and id <> v_canonical
  )
     or lower(trim(member_id)) = v_email;
  get diagnostics v_moved_logs = row_count;

  update public.chat_messages
  set member_id = v_canonical
  where member_id in (
    select id from public.members where lower(trim(email)) = v_email and id <> v_canonical
  )
     or lower(trim(member_id)) = v_email;
  get diagnostics v_moved_messages = row_count;

  update public.member_period_plans
  set member_id = v_canonical
  where member_id in (
    select id from public.members where lower(trim(email)) = v_email and id <> v_canonical
  );
  get diagnostics v_moved_period_plans = row_count;

  update public.members m
  set
    is_active = false,
    coach_notes = trim(
      concat_ws(
        E'\n',
        nullif(m.coach_notes, ''),
        '[dedupe ' || to_char(now(), 'YYYY-MM-DD') || '] slått sammen i ' || v_canonical
      )
    )
  where lower(trim(m.email)) = v_email
    and m.id <> v_canonical;
  get diagnostics v_deactivated = row_count;

  update auth.users u
  set
    raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'member_id')
      || jsonb_build_object('role', 'member', 'member_id', v_canonical),
    raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'member_id')
      || jsonb_build_object('role', 'member', 'member_id', v_canonical)
  where lower(trim(u.email)) = v_email;

  raise notice 'ruudlene dedupe: canonical=%, programs=%, logs=%, messages=%, period_plans=%, deactivated=%',
    v_canonical, v_moved_programs, v_moved_logs, v_moved_messages, v_moved_period_plans, v_deactivated;
end $$;

-- Verifisering
select
  m.id,
  m.is_active,
  count(distinct tp.id) as programs,
  count(distinct wl.id) as logs
from public.members m
left join public.training_programs tp on tp.member_id = m.id
left join public.workout_logs wl on wl.member_id = m.id
where lower(trim(m.email)) = 'ruudlene@gmail.com'
group by m.id, m.is_active
order by m.is_active desc, programs desc, logs desc;

select count(*) filter (where is_active) as active_rows,
       count(*) as total_rows
from public.members
where lower(trim(email)) = 'ruudlene@gmail.com';
