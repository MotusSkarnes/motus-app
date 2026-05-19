-- Fjern auto-genererte rehab-bilde-URL-er (bruker placeholder i appen).
update public.exercise_bank
set image_url = '', updated_at = now()
where id in (
  'e195a', 'e195b', 'e195c', 'e195d', 'e195e', 'e195f', 'e195g', 'e195h',
  'e195i', 'e195j', 'e195k', 'e195l', 'e195m', 'e195n', 'e195o', 'e195p',
  'e195q', 'e195r', 'e195s', 'e195t', 'e195u', 'e195v'
);
