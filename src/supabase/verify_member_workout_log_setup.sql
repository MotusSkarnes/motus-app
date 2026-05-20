-- Kjør i Supabase SQL Editor for å sjekke at intervall-lagring er riktig satt opp.
-- Alle rader skal vise OK / finnes.

select
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_member_workout_log'
  ) as rpc_upsert_member_workout_log_finnes,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'member_can_write_workout_log'
  ) as rpc_member_can_write_finnes,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_logs'
      and policyname = 'workout_logs_insert_member'
  ) as policy_insert_member_finnes;
