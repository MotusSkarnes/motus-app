-- Kjør i Supabase SQL Editor hvis Console viser:
-- "column members.avatar_url does not exist"
alter table public.members add column if not exists avatar_url text;
