-- Canonical member cleanup playbook (production-safe template)
-- Run section-by-section in Supabase SQL Editor.
-- Recommended: take a backup/snapshot before apply-step.

-- ============================================================================
-- 1) DIAGNOSE: duplicate member rows by email
-- ============================================================================

-- Overview: emails with more than one member row
select
  lower(trim(email)) as email_key,
  count(*) as member_rows,
  array_agg(id order by created_at desc) as member_ids,
  array_agg(coalesce(owner_user_id::text, 'null') order by created_at desc) as owner_ids
from public.members
where coalesce(trim(email), '') <> ''
group by lower(trim(email))
having count(*) > 1
order by member_rows desc, email_key asc;

-- Detailed rows for duplicate emails
with duplicate_emails as (
  select lower(trim(email)) as email_key
  from public.members
  where coalesce(trim(email), '') <> ''
  group by lower(trim(email))
  having count(*) > 1
)
select
  m.id,
  m.name,
  m.email,
  m.owner_user_id,
  m.is_active,
  m.invited_at,
  m.created_at,
  m.days_since_activity,
  m.customer_type,
  m.membership_type
from public.members m
join duplicate_emails d
  on lower(trim(m.email)) = d.email_key
order by d.email_key, m.created_at desc;

-- Impact preview: where duplicates are referenced
-- Replace DUPLICATE_ID_1 / DUPLICATE_ID_2 with IDs from diagnosis.
select 'chat_messages' as table_name, count(*) as affected_rows
from public.chat_messages
where member_id in ('DUPLICATE_ID_1', 'DUPLICATE_ID_2')
union all
select 'training_programs', count(*)
from public.training_programs
where member_id in ('DUPLICATE_ID_1', 'DUPLICATE_ID_2')
union all
select 'workout_logs', count(*)
from public.workout_logs
where member_id in ('DUPLICATE_ID_1', 'DUPLICATE_ID_2');

-- ============================================================================
-- 2) PREPARE CANONICAL MAP (manual)
-- ============================================================================
-- Fill one row per duplicate member_id that should be merged into canonical_id.
-- Keep canonical IDs out of duplicate_id column.

drop table if exists tmp_member_canonical_map;
create temporary table tmp_member_canonical_map (
  duplicate_id text primary key,
  canonical_id text not null
);

-- Example rows (replace with real IDs, add/remove rows as needed):
-- insert into tmp_member_canonical_map (duplicate_id, canonical_id) values
--   ('m2_old', 'm2_new'),
--   ('m1_old', 'm1_new');

-- Safety checks before apply
-- 2.1 all canonical IDs must exist
select m.canonical_id
from tmp_member_canonical_map m
left join public.members canonical on canonical.id = m.canonical_id
where canonical.id is null;

-- 2.2 no duplicate points to itself
select *
from tmp_member_canonical_map
where duplicate_id = canonical_id;

-- 2.3 optional: ensure same normalized email for duplicate and canonical
select
  map.duplicate_id,
  d.email as duplicate_email,
  map.canonical_id,
  c.email as canonical_email
from tmp_member_canonical_map map
left join public.members d on d.id = map.duplicate_id
left join public.members c on c.id = map.canonical_id
where lower(trim(coalesce(d.email, ''))) <> lower(trim(coalesce(c.email, '')));

-- ============================================================================
-- 3) APPLY MERGE (transaction)
-- ============================================================================
-- If preview looks wrong: ROLLBACK instead of COMMIT.

begin;

-- Move chat history
update public.chat_messages cm
set member_id = map.canonical_id
from tmp_member_canonical_map map
where cm.member_id = map.duplicate_id;

-- Move training programs
update public.training_programs tp
set member_id = map.canonical_id
from tmp_member_canonical_map map
where tp.member_id = map.duplicate_id;

-- Move workout logs
update public.workout_logs wl
set member_id = map.canonical_id
from tmp_member_canonical_map map
where wl.member_id = map.duplicate_id;

-- Deactivate duplicate member rows
update public.members m
set
  is_active = false,
  coach_notes = trim(
    concat_ws(
      E'\n',
      nullif(m.coach_notes, ''),
      '[dedupe] merged into canonical member id: ' || map.canonical_id || ' on ' || now()::text
    )
  )
from tmp_member_canonical_map map
where m.id = map.duplicate_id;

-- Optional: align auth metadata for canonical member_id (manual per user)
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'CANONICAL_MEMBER_ID'),
--     raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('member_id', 'CANONICAL_MEMBER_ID')
-- where lower(email) = lower('member@example.com');

-- Post-merge preview
select
  lower(trim(email)) as email_key,
  count(*) as member_rows,
  array_agg(id order by created_at desc) as member_ids,
  array_agg(is_active order by created_at desc) as active_flags
from public.members
where coalesce(trim(email), '') <> ''
group by lower(trim(email))
having count(*) > 1
order by member_rows desc, email_key asc;

-- Choose one:
-- rollback;
-- commit;

