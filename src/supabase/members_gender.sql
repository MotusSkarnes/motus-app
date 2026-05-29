-- Kjønn for personlige næringsreferanser (PT setter på kundekort).
alter table public.members
  add column if not exists gender text not null default '';

comment on column public.members.gender is 'female | male | tom — brukes til næringsrapport-referanser';
