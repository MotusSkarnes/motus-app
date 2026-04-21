# Auth + SMTP Setup (Motus PT App)

Praktisk sjekkliste for stabil innlogging, passord-reset og e-postlevering i produksjon.

## 1) Vercel environment variables

I Vercel (`Project -> Settings -> Environment Variables`):

- `VITE_SUPABASE_URL` -> Supabase URL for riktig prosjekt
- `VITE_SUPABASE_ANON_KEY` -> anon key fra samme prosjekt

Etter endring: redeploy.

## 2) Supabase URL Configuration

I Supabase (`Authentication -> URL Configuration`):

- `Site URL`: produksjons-URL (f.eks. Vercel main domain)
- `Redirect URLs`: inkluder minst:
  - `https://<app>.vercel.app/*`
  - eventuell custom domain (`https://<din-domain>/*`)

## 3) Supabase users

I Supabase (`Authentication -> Users`):

- Bekreft at brukeren finnes
- Ved behov: reset eller sett nytt passord manuelt

## 4) SMTP via Resend (produksjon)

I Supabase (`Authentication -> Email/SMTP Settings`), sett:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key (`re_...`)
- Sender email: f.eks. `resepsjon@motus-skarnes.no`
- Sender name: `Motus Skarnes`

## 5) Resend domain verification

I Resend (`Domains`):

- Legg til domenet (f.eks. `motus-skarnes.no`)
- Verifiser DNS-poster hos aktiv DNS-leverandor (ikke nodvendigvis Domeneshop)

Typiske poster:

- `MX` (ofte `feedback-smtp.eu-west-1.amazonses.com`)
- `TXT` (SPF og/eller DKIM public key)
- Eventuell `CNAME`/`TXT` avhengig av hva Resend viser

Viktig: bruk nøyaktig type (`MX`, `TXT`, `CNAME`) som Resend oppgir.

## 6) Hva appen na handterer

- Tydelige login-feil ved tom e-post/passord
- "Glemt passord?" med cooldown (for a unnga rate-limit spam)
- Vennlig melding ved rate-limit
- Recovery-lenker med bade `token_hash` og `access_token/refresh_token`
- Recovery-modus prioriteres over vanlig session (bruker far "Sett nytt passord"-visning)

## 7) Feilsoking

### "Invalid login credentials"

- Bruker/passord matcher ikke i riktig Supabase-prosjekt.

### "missing email or phone"

- Login sendt uten e-post/passord (valideres na i appen).

### "Auth session missing!"

- Recovery-lenke etablerte ikke session. Appen handterer na token-session-setup.

### "Error sending recovery email"

- SMTP/domenekonfig er feil eller ikke verifisert.
- Sjekk Resend domain status + Supabase SMTP credentials.

### "email rate limit exceeded"

- For mange recovery-foresporsler pa kort tid.
- Vent, og bruk cooldown i UI.

## 8) Verifikasjon etter deploy

1. Trigger `Glemt passord?`
2. Bekreft e-post mottatt
3. Klikk lenke -> se "Sett nytt passord"
4. Lagre nytt passord
5. Logg inn med nytt passord

