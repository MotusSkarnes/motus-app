# Day 1 Checklist

Bruk denne sjekklisten mens du setter opp Supabase første gang.

## Preflight lokalt

- [ ] Kjør `npm run check:supabase-env`
- [ ] Kjør `npm run check:supabase-schema`
- [ ] Kjør `npm run test`
- [ ] Kjør `npm run build`

## Supabase SQL

- [ ] Kjør `src/supabase/messages_schema.sql`
- [ ] (Valgfritt) Kjør `src/supabase/seed_minimal.sql`
- [ ] Kjør `src/supabase/verification_checks.sql`

## Auth og metadata

- [ ] Opprett trener-bruker i Supabase Auth
- [ ] Opprett medlem-bruker(e) i Supabase Auth
- [ ] Sett metadata med `src/supabase/auth_metadata_helpers.sql`
  - [ ] Trainer har `role=trainer`
  - [ ] Member har `role=member`
  - [ ] Member har riktig `member_id`

## App-verifisering

- [ ] Logg inn som trener
- [ ] Lagre/rediger/slett program
- [ ] Send melding
- [ ] Logg inn som medlem
- [ ] Les/svar på melding
- [ ] Start og logg økt
- [ ] Refresh siden og bekreft persistens

## Sikkerhet (når alt over fungerer)

- [ ] Kjør `src/supabase/rls_strict.sql`
- [ ] Re-test trener/medlem etter strict RLS
