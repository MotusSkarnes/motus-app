-- Optional: run in Supabase SQL Editor if you want profile photos stored on members.
alter table public.members add column if not exists avatar_url text;
