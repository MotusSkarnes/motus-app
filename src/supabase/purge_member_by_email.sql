-- Slett medlem + all historikk + Auth-bruker for én e-post (testbruker).
-- Kjør: npx supabase db query --linked -f src/supabase/purge_member_by_email.sql

do $$
declare
  _target_email text := 'ibenkrogseter@gmail.com';
  _member_ids text[];
  _auth_user_ids uuid[];
  _mid text;
  _uid uuid;
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

  if coalesce(array_length(_member_ids, 1), 0) = 0
     and coalesce(array_length(_auth_user_ids, 1), 0) = 0 then
    raise notice 'Ingen medlemsrader eller Auth-brukere for %', _target_email;
    return;
  end if;

  begin
    foreach _uid in array coalesce(_auth_user_ids, '{}') loop
      delete from public.push_subscriptions where user_id = _uid::text;
    end loop;
  exception
    when undefined_table then
      null;
  end;

  foreach _mid in array coalesce(_member_ids, '{}') loop
    delete from public.member_period_plans where member_id = _mid;
    delete from public.chat_messages where member_id = _mid;
    delete from public.workout_logs where member_id = _mid;
    delete from public.training_programs where member_id = _mid;
  end loop;

  delete from public.members m
  where lower(trim(m.email)) = lower(trim(_target_email));

  foreach _uid in array coalesce(_auth_user_ids, '{}') loop
    delete from auth.users where id = _uid;
  end loop;

  raise notice 'Full purge completed for % (% member ids, % auth users)',
    _target_email,
    coalesce(array_length(_member_ids, 1), 0),
    coalesce(array_length(_auth_user_ids, 1), 0);
end $$;
