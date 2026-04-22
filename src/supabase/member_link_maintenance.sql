-- Member/auth link maintenance helpers for Supabase.
-- Run blocks one by one in SQL Editor.

-- =========================================================
-- 1) HEALTH CHECK: find duplicate member rows per email
-- =========================================================
select
  lower(m.email) as email,
  count(*) as member_rows,
  sum(case when m.is_active then 1 else 0 end) as active_rows,
  string_agg(m.id, ', ' order by m.created_at desc) as member_ids
from public.members m
where coalesce(trim(m.email), '') <> ''
group by lower(m.email)
having count(*) > 1
order by count(*) desc, lower(m.email);


-- =========================================================
-- 2) HEALTH CHECK: member auth metadata coverage
-- =========================================================
select
  lower(u.email) as email,
  u.id as auth_user_id,
  u.raw_app_meta_data ->> 'role' as auth_role,
  u.raw_app_meta_data ->> 'member_id' as auth_member_id,
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(u.email)
  ) as has_member_row_for_email
from auth.users u
where coalesce(trim(u.email), '') <> ''
order by lower(u.email);


-- =========================================================
-- 3) CHECK ONE MEMBER EMAIL
--    Replace KUNDE_EMAIL_HER first
-- =========================================================
with member_rows as (
  select
    m.id,
    m.email,
    m.owner_user_id,
    m.is_active,
    m.created_at
  from public.members m
  where lower(m.email) = lower('KUNDE_EMAIL_HER')
),
program_rows as (
  select
    p.id,
    p.member_id,
    p.owner_user_id,
    p.title,
    p.created_at
  from public.training_programs p
  where p.member_id in (select id from member_rows)
),
message_rows as (
  select
    c.id,
    c.member_id,
    c.owner_user_id,
    c.sender,
    c.created_at
  from public.chat_messages c
  where c.member_id in (select id from member_rows)
),
auth_rows as (
  select
    u.id as auth_user_id,
    u.email,
    u.raw_app_meta_data ->> 'member_id' as auth_member_id,
    u.raw_app_meta_data ->> 'role' as auth_role
  from auth.users u
  where lower(u.email) = lower('KUNDE_EMAIL_HER')
)
select
  'member'::text as source,
  mr.id::text as key_id,
  mr.email::text as email,
  mr.owner_user_id::text as owner_user_id,
  mr.is_active::text as extra_1,
  null::text as extra_2
from member_rows mr
union all
select
  'program'::text as source,
  pr.id::text as key_id,
  null::text as email,
  pr.owner_user_id::text as owner_user_id,
  pr.member_id::text as extra_1,
  pr.title::text as extra_2
from program_rows pr
union all
select
  'message'::text as source,
  ms.id::text as key_id,
  null::text as email,
  ms.owner_user_id::text as owner_user_id,
  ms.member_id::text as extra_1,
  ms.sender::text as extra_2
from message_rows ms
union all
select
  'auth'::text as source,
  ar.auth_user_id::text as key_id,
  ar.email::text as email,
  null::text as owner_user_id,
  ar.auth_member_id::text as extra_1,
  ar.auth_role::text as extra_2
from auth_rows ar;


-- =========================================================
-- 4) REPAIR ONE MEMBER EMAIL
--    Replace KUNDE_EMAIL_HER first
--    Consolidates programs/messages/logs to one canonical member_id
--    and updates auth.users app_metadata.member_id
-- =========================================================
do $$
declare
  v_email text := lower('KUNDE_EMAIL_HER');
  v_canonical_member_id text;
begin
  select id
  into v_canonical_member_id
  from public.members
  where lower(email) = v_email
  order by is_active desc, created_at desc
  limit 1;

  if v_canonical_member_id is null then
    raise exception 'Fant ingen member-rad for %', v_email;
  end if;

  update public.training_programs
  set member_id = v_canonical_member_id
  where member_id in (
    select id from public.members where lower(email) = v_email
  );

  update public.chat_messages
  set member_id = v_canonical_member_id
  where member_id in (
    select id from public.members where lower(email) = v_email
  );

  update public.workout_logs
  set member_id = v_canonical_member_id
  where member_id in (
    select id from public.members where lower(email) = v_email
  );

  update public.members
  set is_active = (id = v_canonical_member_id)
  where lower(email) = v_email;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'member', 'member_id', v_canonical_member_id)
  where lower(email) = v_email;
end $$;
