-- Grete Sparby (gs@njf.no) — invitasjon / innlogging
-- PT: iben@motus-skarnes.no
--
-- Kjør seksjon 1–2 først (diagnose). Deretter 3 (repair) i én transaksjon.
-- Etterpå: i appen → Klienter → Grete → «Send invitasjon på nytt» (forceResend).

-- ============================================================================
-- 1) Medlemsrader
-- ============================================================================
select
  m.id,
  m.name,
  m.email,
  m.is_active,
  m.owner_user_id::text as owner_user_id,
  m.customer_type,
  m.membership_type,
  m.invited_at,
  m.first_login_at
from public.members m
where lower(trim(m.email)) = lower('gs@njf.no')
   or (lower(trim(m.name)) like '%grete%' and lower(trim(m.name)) like '%sparby%')
order by m.is_active desc, m.created_at desc nulls last;

-- ============================================================================
-- 2) Auth (member_id i metadata må matche aktiv members.id)
-- ============================================================================
select
  u.id as auth_user_id,
  u.email,
  u.raw_app_meta_data ->> 'role' as app_role,
  u.raw_app_meta_data ->> 'member_id' as app_member_id,
  u.raw_user_meta_data ->> 'member_id' as user_member_id,
  u.email_confirmed_at,
  u.last_sign_in_at
from auth.users u
where lower(trim(u.email)) = lower('gs@njf.no');

-- PT Iben (forventet owner_user_id på Grete sin rad):
select id::text, email from auth.users where lower(trim(email)) = lower('iben@motus-skarnes.no');

-- ============================================================================
-- 3) REPAIR
-- ============================================================================
begin;

-- Kanonisk id: eksisterende rad for gs@njf.no, ellers member-gsparby
do $$
declare
  v_email text := lower('gs@njf.no');
  v_trainer_id uuid;
  v_canonical_id text;
  v_grete_auth_id uuid;
begin
  select id into v_trainer_id
  from auth.users
  where lower(trim(email)) = lower('iben@motus-skarnes.no')
  limit 1;

  if v_trainer_id is null then
    raise exception 'Fant ikke PT-bruker iben@motus-skarnes.no i auth.users';
  end if;

  select id into v_canonical_id
  from public.members
  where lower(trim(email)) = v_email
  order by is_active desc, created_at desc nulls last
  limit 1;

  if v_canonical_id is null then
    v_canonical_id := 'member-gsparby';
    insert into public.members (
      id,
      owner_user_id,
      name,
      email,
      is_active,
      customer_type,
      membership_type,
      invited_at,
      phone,
      birth_date,
      weight,
      height,
      level,
      days_since_activity,
      goal,
      focus,
      personal_goals,
      injuries,
      coach_notes
    ) values (
      v_canonical_id,
      v_trainer_id,
      'Grete Sparby',
      v_email,
      true,
      'PT-kunde',
      'Premium',
      now(),
      '',
      '',
      '',
      '',
      'Nybegynner',
      '0',
      '',
      '',
      '',
      '',
      ''
    );
  else
    update public.members
    set
      owner_user_id = v_trainer_id,
      name = 'Grete Sparby',
      email = v_email,
      is_active = true,
      customer_type = 'PT-kunde',
      membership_type = coalesce(nullif(trim(membership_type), ''), 'Premium')
    where id = v_canonical_id;
  end if;

  select id into v_grete_auth_id from auth.users where lower(trim(email)) = v_email limit 1;

  -- Feil: owner_user_id peker på medlemmets egen auth-id (skjuler kunden for PT)
  if v_grete_auth_id is not null then
    update public.members
    set owner_user_id = v_trainer_id
    where id = v_canonical_id
      and owner_user_id = v_grete_auth_id;
  end if;

  -- Slå sammen programmer/logs/meldinger til kanonisk id
  update public.training_programs
  set member_id = v_canonical_id
  where owner_user_id = v_trainer_id
    and member_id in (
      select id from public.members where lower(trim(email)) = v_email and id <> v_canonical_id
    );

  update public.training_programs
  set member_id = v_canonical_id
  where owner_user_id = v_trainer_id
    and lower(trim(member_id)) = v_email;

  update public.workout_logs
  set member_id = v_canonical_id
  where owner_user_id = v_trainer_id
    and (
      member_id in (select id from public.members where lower(trim(email)) = v_email and id <> v_canonical_id)
      or lower(trim(member_id)) = v_email
    );

  update public.chat_messages
  set member_id = v_canonical_id
  where owner_user_id = v_trainer_id
    and (
      member_id in (select id from public.members where lower(trim(email)) = v_email and id <> v_canonical_id)
      or lower(trim(member_id)) = v_email
    );

  -- Deaktiver duplikat-rader
  update public.members
  set is_active = false
  where lower(trim(email)) = v_email
    and id <> v_canonical_id;

  -- Auth metadata
  update auth.users u
  set
    raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'member', 'member_id', v_canonical_id),
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'member', 'member_id', v_canonical_id)
  where lower(trim(u.email)) = v_email;

  raise notice 'Kanonisk member_id: %, trainer: %', v_canonical_id, v_trainer_id;
end $$;

-- Verifiser
select id, name, email, is_active, owner_user_id::text, customer_type, membership_type
from public.members
where lower(trim(email)) = lower('gs@njf.no');

select
  id as auth_user_id,
  email,
  raw_app_meta_data ->> 'member_id' as app_member_id
from auth.users
where lower(trim(email)) = lower('gs@njf.no');

commit;
-- rollback;
