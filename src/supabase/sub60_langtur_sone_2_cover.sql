-- Sett forsidebilde på eksisterende SUB60 langtur-programmer (kjør i Supabase SQL Editor).
-- Bildet ligger i appen under public/program-covers/sub60-langtur-sone-2.png

update public.training_programs
set image_url = '/program-covers/sub60-langtur-sone-2.png'
where lower(trim(title)) = lower('SUB60 · Langtur sone 2');
