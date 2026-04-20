# Supabase Go-Live Guide

Denne guiden er laget for prosjektet slik det står nå.
Målet er trygg overgang fra demo/local til ekte Supabase-drift.

## 0) Før du starter

- Verifiser at appen bygger og tester lokalt:
  - `npm run test`
  - `npm run build`
- Sørg for at du har tilgang til Supabase-prosjektet med SQL Editor.

## 1) Konfigurer appen for Supabase

Opprett fil `src/.env` (ikke commit):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Start appen og bekreft:
- quick-login knapper er skjult
- login skjer med Supabase Auth

## 2) Opprett tabeller + dev-policies

Kjør denne filen i Supabase SQL Editor:

- `src/supabase/messages_schema.sql`

Dette oppretter:
- `members`
- `chat_messages`
- `training_programs`
- `workout_logs`

...med åpne dev-policies (`using (true)`), så du kan validere flyt først.

Alternativt kan du kjøre alt i en fil:
- `src/supabase/production_bootstrap.sql`
- erstatt `OWNER_USER_ID` i filen med trenerens `auth.users.id` før kjøring

## 3) Opprett auth-brukere

Lag minst:
- 1 trener
- 1–2 medlemmer

Du kan gjøre dette i Auth-panelet i Supabase.

## 4) Sett metadata for roller og member-kobling

Kjør/bruk hjelperen:
- `src/supabase/auth_metadata_helpers.sql`

Sett:
- trener: `role = "trainer"`
- medlem: `role = "member"` + `member_id = <members.id>`

Alternativ med invitasjon fra appen:
- deploy Edge Function `supabase/functions/invite-member/index.ts`
- funksjonen inviterer på e-post og setter metadata (`role=member`, `member_id`) automatisk

Eksempel deploy:
- `supabase functions deploy invite-member`
- `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`

## 5) Seed minimum data (valgfritt)

Hvis du vil ha rask demo med ekte backend-data:
- `src/supabase/seed_minimal.sql`

## 6) Verifiser flyt i app

Test:
- trener login
- medlem login
- opprette/slette program
- sende meldinger begge veier
- logge økt (workout log)
- side refresh (data fortsatt synlig)

Bruk:
- `src/supabase/verification_checks.sql`

## 7) Stram sikkerhet (strict RLS)

Når alt over fungerer:
- kjør `src/supabase/rls_strict.sql`

Hvis du brukte `production_bootstrap.sql`, er strict RLS allerede inkludert.

Dette:
- legger til `owner_user_id`-basert tilgang
- erstatter åpne dev-policies med `auth.uid()`-regler

## 8) Re-verifiser etter strict RLS

Sjekk:
- trener A ser ikke trener B sine data
- medlem ser kun egne data
- insert/update/delete funker fortsatt for eier

Hvis noe feiler:
- sjekk at metadata (`role`, `member_id`) er satt riktig
- sjekk at data har riktig `owner_user_id`

## 9) Før produksjon

- Innfør passordpolicy/e-postbekreftelse i Auth
- Sett backup-policy i Supabase
- Legg på feillogging i frontend (f.eks. Sentry)
- Gå gjennom PII/GDPR-vurdering for medlemsdata
