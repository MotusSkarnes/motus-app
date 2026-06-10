-- Verifiser at ingen RLS-policies refererer user_metadata.
select
  c.relname as table_name,
  p.polname as policy_name
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (
    coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%user_metadata%'
    or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%user_metadata%'
  )
order by 1, 2;
