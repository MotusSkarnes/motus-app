-- Medlem: skjul eller arkiver program i eget bibliotek (kolonne brukes av appen under «Mine treningsprogram»).
-- Idempotent: trygg å kjøre flere ganger.

alter table public.training_programs add column if not exists member_library_status text;

comment on column public.training_programs.member_library_status is 'hidden | archived — medlemsvisning; null = synlig i hovedlisten';

-- Kjør også training_programs_member_library_rls.sql slik at medlem kan lagre skjul/arkiv til Supabase.
