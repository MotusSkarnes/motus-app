-- Konfigurerbare programvariabler per øvelse (min, sek, kg, reps, pause, sete).
alter table public.exercise_bank
  add column if not exists prescription_fields jsonb not null default '[]'::jsonb;

-- Egen standard per kategori (hver øvelse får egen kopi — kan tilpasses individuelt etterpå).
update public.exercise_bank
set prescription_fields = case category
  when 'Kondisjon' then '["minutes","seconds","pause"]'::jsonb
  when 'Mobilitet' then '["seconds","pause"]'::jsonb
  when 'Rehab' then '["seconds","pause"]'::jsonb
  when 'Uttøyning' then '["seconds","pause"]'::jsonb
  else '["reps","kg","pause"]'::jsonb
end
where prescription_fields is null
   or prescription_fields = '[]'::jsonb
   or jsonb_array_length(prescription_fields) = 0;
