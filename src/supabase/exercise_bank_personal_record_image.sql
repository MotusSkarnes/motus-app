alter table public.exercise_bank
  add column if not exists personal_record_image_url text not null default '';
