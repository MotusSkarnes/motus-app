-- Konfigurerbare programvariabler per øvelse (min, sek, kg, reps, pause, sete).
alter table public.exercise_bank
  add column if not exists prescription_fields jsonb not null default '[]'::jsonb;
