-- Sett forsidebilde på eksisterende mobilitet-for-løpere-programmer (kjør i Supabase SQL Editor).
-- Bildet ligger i appen under public/program-covers/mobilitet.png

update public.training_programs
set image_url = '/program-covers/mobilitet.png'
where lower(trim(title)) in (
  lower('SUB60 · Mobilitet løper'),
  lower('SUB45 · Mobilitet løper')
);
