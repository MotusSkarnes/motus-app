-- Utvid exercise_bank.category til Mobilitet og Rehab (idempotent).
-- Kjør før seed_rehab_exercises.sql hvis insert feiler på category check.

alter table public.exercise_bank
  drop constraint if exists exercise_bank_category_check;

alter table public.exercise_bank
  add constraint exercise_bank_category_check
  check (category in ('Styrke', 'Kondisjon', 'Mobilitet', 'Rehab', 'Uttøyning'));
