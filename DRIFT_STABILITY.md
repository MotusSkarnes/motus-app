# Drift og stabilitet (Motus PT)

Kort sjekkliste for trygg produksjon. Kjør stegene i rekkefølge etter deploy av ny app-kode.

## 1. Lokalt før release

```bash
npm run test
npm run build
npm run check:supabase-env
npm run check:production-readiness
```

`check:production-readiness` krever `src/.env` med Supabase-nøkler.

## 2. SQL i Supabase (produksjon)

Kjør i **SQL Editor** (én fil om gangen, eller start med patch):

| Rekkefølge | Fil | Formål |
|------------|-----|--------|
| **1** | `src/supabase/production_stability_patch.sql` | RLS for medlem + delte Medlem-kunder, Rehab-kategori, push-tabell |
| 2 | `src/supabase/seed_rehab_exercises.sql` | Rehab-øvelser (valgfritt, hvis bank er tom) |
| 3 | `src/supabase/verification_checks_stability.sql` | Diagnose — ingen endringer |

Hvis `production_stability_patch.sql` returnerer **3 rader** i policy-sjekken nederst, er RLS OK.

Ved duplikat-`members` eller feil `member_id`: se `src/supabase/canonical_member_cleanup.sql` (backup først).

## 3. Vercel miljøvariabler

| Variabel | Eksempel |
|----------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_SITE_URL` | `https://motus-pt-app.vercel.app` (eller eget domene) |

## 4. Supabase Auth URL Configuration

- **Site URL** = samme som `VITE_SITE_URL`
- **Redirect URLs** = `https://<din-app>/*` (+ ev. `.vercel.app` under overgang)

## 5. Edge Functions (backend)

Etter kodeendringer under `supabase/functions/`:

```bash
npm run supabase:deploy-core
```

Sett secrets (Dashboard eller CLI):

```bash
npx supabase secrets set PUBLIC_APP_URL=https://motus-pt-app.vercel.app
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## 6. Manuell QA (15–30 min)

Bruk `docs/motus-test-checkliste.pdf`, med fokus på:

- Innlogging PT og medlem (inkl. invitasjonslenke)
- Medlem ser egne programmer og økter etter refresh
- PT ser programmer på **Medlem**-kunder (delt kunde)
- Varsler: teller og rød «Ny» stemmer
- Melding begge veier

## 7. Eget domene (når dere er klare)

1. Vercel → Domains → legg til `app.motus-skarnes.no` (eller tilsvarende)
2. Oppdater `VITE_SITE_URL` og redeploy
3. Oppdater Supabase redirect-URL-er
4. Oppdater `PUBLIC_APP_URL` på `invite-member`

## Vanlige symptomer

| Symptom | Sannsynlig årsak | Løsning |
|---------|------------------|---------|
| Medlem ser ingen programmer | RLS kun `owner_user_id` | Kjør `production_stability_patch.sql` |
| PT ser ikke program på Medlem-kunde | Mangler delt Medlem-policy | Samme patch |
| Invitasjon peker til feil URL | Mangler `VITE_SITE_URL` / `PUBLIC_APP_URL` | Sett env + secrets, redeploy |
| «X nytt» uten røde varsler | Fikset i app — hard refresh | Siste deploy fra `main` |
| Duplikat kunder i liste | Flere `members`-rader per e-post | `canonical_member_cleanup.sql` |
