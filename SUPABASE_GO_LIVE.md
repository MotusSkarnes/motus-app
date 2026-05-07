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

### Edge Functions – deploy-rutine etter endringer

Frontend (Vercel) og Supabase er **to separate deploy**. Når du endrer filer under `supabase/functions/`, må funksjonene deployes til **samme Supabase-prosjekt** som appen bruker (`VITE_SUPABASE_URL`), ellers kjører produksjon gammel backend-logikk.

Minst disse når du jobber med chat, hydrering eller auth-kobling mot medlem:

```bash
npx supabase functions deploy send-chat-message
npx supabase functions deploy hydrate-member-data
npx supabase functions deploy link-member-auth
```

Andre funksjoner kan også være aktuelle etter endring, f.eks. `invite-member`, `send-message-push`.

**Lokal state vs. Supabase:** Uten `VITE_SUPABASE_*` (demo) lagres meldinger og annen state i `localStorage`. Med Supabase er kilden etter hydrering i stor grad serverdata. «Reset lokal chat-cache» i Admin påvirker kun lokalt cachede meldinger (ikke rader i databasen).

### Data-hygiene etter duplikate `members`-rader / chat-historikk

Chat-feil kan etterlate **flere `members`-rader per e-post** og meldinger spredt på `m1` / `m2` med ulike `owner_user_id`. Det gir rare historikker selv når app-koden er fikset.

Anbefalt rekkefølge:

1. **Backup** (Supabase Dashboard → Database → backups / egen dump).
2. **Kjør verifisering** i SQL Editor: `src/supabase/verification_checks.sql` (tilpass e-post / testtekst etter behov).
3. **Beslutt én canonical `member_id` per kunde** (typisk aktiv, nyeste rad – eller den som matcher `auth.users` metadata).
4. **Oppdater** `auth.users` (`raw_app_meta_data` / `raw_user_meta_data`: `member_id`, `role`).
5. **Flytt eller konsolider** rader i `chat_messages` (og ev. `training_programs`) til canonical `member_id` / riktig `owner_user_id` – kun etter at du har verifisert i SQL at du treffer riktig kunde.

Ikke kjør masseoppdatering i produksjon uten å ha kjørt diagnose-spørringer på én kunde først.

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
- medlem ser kun egne data (basert på `member_id` i auth metadata)
- insert/update/delete funker fortsatt for eier

Hvis noe feiler:
- sjekk at metadata (`role`, `member_id`) er satt riktig
- sjekk at data har riktig `owner_user_id`

Vanlig symptom og løsning:
- symptom: PT ser tildelte programmer, men medlem ser ingenting
- årsak: select-policy tillater kun `owner_user_id = auth.uid()`
- løsning: bruk select-policy som tillater enten trener-eier eller medlem med matching `auth.jwt()->app_metadata.member_id`

## 9) Før produksjon

- Innfør passordpolicy/e-postbekreftelse i Auth
- Sett backup-policy i Supabase
- Legg på feillogging i frontend (f.eks. Sentry)
- Gå gjennom PII/GDPR-vurdering for medlemsdata

## 10) Aktivér bildeopplasting i Øvelsesbank

For å bruke "Last opp bilde" i trenerens øvelsesbank, kjør:

- `src/supabase/exercise_image_storage.sql`

Dette gjør:

- oppretter/oppdaterer bucket `exercise-images`
- setter bucket som offentlig (slik at `getPublicUrl()` kan vises i appen)
- begrenser filer til `image/jpeg`, `image/png`, `image/webp`
- setter maks filstørrelse til 5 MB
- oppretter policies for:
  - offentlig lesing
  - opplasting/redigering/sletting for `authenticated` brukere

Rask verifisering etter kjøring:

- Logg inn som trener
- Gå til `Øvelsesbank`
- Velg en øvelse eller lag ny
- Klikk `Last opp bilde`
- Bekreft at preview vises og lagring fungerer
