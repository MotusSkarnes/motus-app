-- Legg til rehab-øvelser i øvelsesbanken (idempotent).
-- Kjør først (én gang): npx supabase db query --linked -f src/supabase/exercise_bank_add_mobilitet_rehab_category.sql
-- Deretter: npx supabase db query --linked -f src/supabase/seed_rehab_exercises.sql

insert into public.exercise_bank (id, name, category, muscle_group, equipment, level, description, is_active)
values
  ('e195e', 'Terminal knee extension', 'Rehab', 'Bein', 'Strikk', 'Nybegynner', 'Strekk kneet sakte ut mot strikk og hold 2–3 sek i full strekk uten smerte.', true),
  ('e195f', 'Quad set isometrisk', 'Rehab', 'Bein', 'Kroppsvekt', 'Nybegynner', 'Spenn forsiden av låret med kneet strakt, hold 5–10 sek og slipp av.', true),
  ('e195g', 'Heel slide mot vegg', 'Rehab', 'Bein', 'Kroppsvekt', 'Nybegynner', 'Skyv hælen langs gulvet mot setet i smertefri vinkel, rolig frem og tilbake.', true),
  ('e195h', 'Spanish squat isometrisk', 'Rehab', 'Bein', 'Strikk', 'Litt øvet', 'Hold lett knebøy med strikk bak knærne, hold 20–30 sek med stabil kjerne.', true),
  ('e195i', 'Enbensbalanse', 'Rehab', 'Bein', 'Kroppsvekt', 'Nybegynner', 'Stå på ett ben 20–40 sek med mild knebøy og stabil hofte.', true),
  ('e195j', 'Clamshell', 'Rehab', 'Hofte', 'Strikk', 'Nybegynner', 'Ligg på siden, roter hoften ut mot strikk uten å rulle bekkenet.', true),
  ('e195k', 'Sidelegg hip abduction', 'Rehab', 'Hofte', 'Strikk', 'Nybegynner', 'Løft øvre ben kontrollert med strikk over knærne, hold kort i topp.', true),
  ('e195l', 'Monster walk', 'Rehab', 'Hofte', 'Strikk', 'Nybegynner', 'Gå sidelengs med strikk over knær, hold spenning i hoften gjennom stegene.', true),
  ('e195m', 'Glute bridge single leg', 'Rehab', 'Sete', 'Kroppsvekt', 'Litt øvet', 'Løft hoften med ett ben strakt frem, hold 2 sek og senk uten rotasjon.', true),
  ('e195n', 'Ekstern rotasjon skulder', 'Rehab', 'Skuldre', 'Strikk', 'Nybegynner', 'Albue ved siden, roter underarmen ut mot strikk i kontrollert tempo.', true),
  ('e195o', 'Skulder Y-T-W', 'Rehab', 'Skuldre', 'Kroppsvekt', 'Nybegynner', 'Ligg på magen, løft armene i Y-, T- og W-baner med lett squeeze i skulderblad.', true),
  ('e195p', 'Scapular push-up', 'Rehab', 'Skuldre', 'Kroppsvekt', 'Nybegynner', 'Hold planke eller kneplanke og beveg kun skulderblad frem og tilbake.', true),
  ('e195q', 'Eksentrisk calf raise', 'Rehab', 'Ankel', 'Trapp', 'Nybegynner', 'Stå på trapp, løft opp med begge ben og senk sakte ned på ett ben.', true),
  ('e195r', 'Tåhev isometrisk', 'Rehab', 'Ankel', 'Vegg', 'Nybegynner', 'Stå med tærne mot vegg, press forover og hold 15–20 sek.', true),
  ('e195s', 'Bird dog', 'Rehab', 'Kjerne', 'Kroppsvekt', 'Nybegynner', 'Strek motsatt arm og ben, hold ryggen nøytral i 3–5 sek.', true),
  ('e195t', 'Dead bug', 'Rehab', 'Kjerne', 'Kroppsvekt', 'Nybegynner', 'Ligg på ryggen, senk motsatt arm og ben sakte mens korsryggen holdes stabil.', true),
  ('e195u', 'Pallof press isometrisk', 'Rehab', 'Kjerne', 'Strikk', 'Nybegynner', 'Hold strikk foran brystet og motstå rotasjon i 15–20 sek per side.', true),
  ('e195v', 'Cat-cow kontrollert', 'Rehab', 'Rygg', 'Kroppsvekt', 'Nybegynner', 'Rull sakte mellom lett ryggbue og nøytral rygg uten å presse i smerte.', true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  level = excluded.level,
  description = excluded.description,
  is_active = true,
  updated_at = now();
