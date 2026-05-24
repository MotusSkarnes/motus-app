-- Sett forsidebilde på eksisterende styrke-for-løpere-programmer (kjør i Supabase SQL Editor).
-- Bildet ligger i appen under public/program-covers/styrke-loper.png

update public.training_programs
set image_url = '/program-covers/styrke-loper.png'
where lower(trim(title)) in (
  lower('SUB60 · Styrke løper'),
  lower('SUB45 · Styrke løper')
);
