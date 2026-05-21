# Supabase Auth e-postmaler

Lim inn innholdet fra `invite.html` i Supabase Dashboard:

**Authentication → Email Templates → Invite user**

Legg også til redirect-URL i **Authentication → URL Configuration → Redirect URLs**:

- `https://motus-pt-app.vercel.app/aktiver`
- `https://motuspt.no/aktiver` (produksjonsdomene)

`PUBLIC_APP_URL` / `VITE_SITE_URL` skal peke til samme domene.
