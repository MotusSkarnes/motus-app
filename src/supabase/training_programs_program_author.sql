-- Oppfav for treningsprogram (medlem vs trener). Kjør mot eksisterende Supabase-prosjekt.
-- Idempotent: trygg å kjøre flere ganger.

alter table public.training_programs add column if not exists program_created_by text;
alter table public.training_programs add column if not exists program_created_by_name text;

comment on column public.training_programs.program_created_by is 'member | trainer — hvem som opprettet/oppdaterte programmet i appen';
comment on column public.training_programs.program_created_by_name is 'Visningsnavn (fornavn eller kort navn) for opphavsperson';
