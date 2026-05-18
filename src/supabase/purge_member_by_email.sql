-- Full purge: medlem, Auth, programmer, logger og relatert data for én e-post.
-- Kjør: npx supabase db query --linked -f src/supabase/purge_member_by_email.sql

do $$
declare
  _target_email text := 'ibenkrogseter@gmail.com';
  _member_ids text[];
  _auth_user_ids uuid[];
  _scope_keys text[];
  _uid uuid;
  _deleted_programs int := 0;
  _deleted_logs int := 0;
  _deleted_messages int := 0;
  _deleted_period_plans int := 0;
  _row_count int := 0;
  _deleted_members int := 0;
  _deleted_auth int := 0;
begin
  select coalesce(array_agg(distinct u.id), '{}')
  into _auth_user_ids
  from auth.users u
  where lower(trim(u.email)) = lower(trim(_target_email));

  select coalesce(array_agg(distinct id), '{}')
  into _member_ids
  from (
    select m.id
    from public.members m
    where lower(trim(m.email)) = lower(trim(_target_email))
    union
    select coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id')
    from auth.users u
    where lower(trim(u.email)) = lower(trim(_target_email))
      and coalesce(u.raw_app_meta_data->>'member_id', u.raw_user_meta_data->>'member_id') is not null
    union
    select u.id::text
    from auth.users u
    where lower(trim(u.email)) = lower(trim(_target_email))
  ) all_ids
  where id is not null and trim(id) <> '';

  select coalesce(array_agg(distinct key), '{}')
  into _scope_keys
  from (
    select unnest(coalesce(_member_ids, '{}')) as key
    union
    select u::text from unnest(coalesce(_auth_user_ids, '{}')) as u
    union
    select lower(trim(_target_email))
  ) scoped
  where key is not null and trim(key) <> '';

  raise notice 'Purge scope for %: % member ids, % auth users, % scope keys',
    _target_email,
    coalesce(array_length(_member_ids, 1), 0),
    coalesce(array_length(_auth_user_ids, 1), 0),
    coalesce(array_length(_scope_keys, 1), 0);

  -- Programmer/logger kan ligge på member_id = rad-id, auth-uuid eller e-post (legacy).
  delete from public.workout_logs wl
  where wl.member_id = any (_scope_keys)
     or lower(trim(wl.member_id)) = lower(trim(_target_email))
     or (
       coalesce(array_length(_auth_user_ids, 1), 0) > 0
       and wl.owner_user_id = any (_auth_user_ids)
     );
  get diagnostics _deleted_logs = row_count;

  delete from public.training_programs tp
  where tp.member_id = any (_scope_keys)
     or lower(trim(tp.member_id)) = lower(trim(_target_email))
     or (
       coalesce(array_length(_auth_user_ids, 1), 0) > 0
       and tp.owner_user_id = any (_auth_user_ids)
     );
  get diagnostics _deleted_programs = row_count;

  begin
    foreach _uid in array coalesce(_auth_user_ids, '{}') loop
      delete from public.push_subscriptions where user_id = _uid::text;
    end loop;
  exception
    when undefined_table then
      null;
  end;

  delete from public.member_period_plans mpp
  where mpp.member_id = any (_scope_keys)
     or lower(trim(mpp.member_id)) = lower(trim(_target_email));
  get diagnostics _deleted_period_plans = row_count;

  -- Chat kan ha member_id = rad-id, e-post eller auth-uuid.
  delete from public.chat_messages cm
  where cm.member_id = any (_scope_keys)
     or lower(trim(cm.member_id)) = lower(trim(_target_email));
  get diagnostics _deleted_messages = row_count;

  delete from public.members m
  where lower(trim(m.email)) = lower(trim(_target_email));
  get diagnostics _deleted_members = row_count;

  foreach _uid in array coalesce(_auth_user_ids, '{}') loop
    delete from auth.users where id = _uid;
    get diagnostics _row_count = row_count;
    _deleted_auth := _deleted_auth + _row_count;
  end loop;

  raise notice 'Deleted: % programs, % workout_logs, % messages, % period_plans, % members, % auth users',
    _deleted_programs,
    _deleted_logs,
    _deleted_messages,
    _deleted_period_plans,
    _deleted_members,
    _deleted_auth;

  raise notice 'Remaining programs for scope: %',
    (select count(*) from public.training_programs tp
      where tp.member_id = any (_scope_keys)
         or lower(trim(tp.member_id)) = lower(trim(_target_email))
         or (coalesce(array_length(_auth_user_ids, 1), 0) > 0 and tp.owner_user_id = any (_auth_user_ids)));

  raise notice 'Remaining logs for scope: %',
    (select count(*) from public.workout_logs wl
      where wl.member_id = any (_scope_keys)
         or lower(trim(wl.member_id)) = lower(trim(_target_email))
         or (coalesce(array_length(_auth_user_ids, 1), 0) > 0 and wl.owner_user_id = any (_auth_user_ids)));

  raise notice 'Remaining members with email: %',
    (select count(*) from public.members m where lower(trim(m.email)) = lower(trim(_target_email)));

  raise notice 'Remaining auth users with email: %',
    (select count(*) from auth.users u where lower(trim(u.email)) = lower(trim(_target_email)));
end $$;
