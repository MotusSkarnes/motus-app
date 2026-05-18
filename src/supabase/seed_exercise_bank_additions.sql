-- Legg til nye øvelser i øvelsesbanken (idempotent).
-- Kjør: npx supabase db query --linked -f src/supabase/seed_exercise_bank_additions.sql

insert into public.exercise_bank (id, name, category, muscle_group, equipment, level, description, is_active)
values
  ('e196', 'Leg curl i maskin', 'Styrke', 'Bakside lår', 'Maskin', 'Nybegynner', 'Trekk hælene mot setet med hoften i puten gjennom hele bevegelsen.', true),
  ('e197', 'Leg extension i maskin', 'Styrke', 'Forside lår', 'Maskin', 'Nybegynner', 'Spark ut kontrollert og hold et kort stopp i topposisjon uten å løfte hoften.', true),
  ('e198', 'Crunches på ball', 'Styrke', 'Kjerne', 'Stabilitetsball', 'Nybegynner', 'Ligg med øvre rygg på ballen, spenn magen og curl overkroppen kontrollert opp.', true),
  ('e199', 'Sittende ro i maskin', 'Styrke', 'Rygg', 'Maskin', 'Nybegynner', 'Trekk håndtaket mot magen med brystet oppe og skulderbladene sammen i slutten.', true),
  ('e200', 'Glute drive maskin', 'Styrke', 'Sete', 'Maskin', 'Nybegynner', 'Press hoften frem i maskinen med kontrollert tempo og klem setet i topp.', true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  level = excluded.level,
  description = excluded.description,
  is_active = true,
  updated_at = now();
