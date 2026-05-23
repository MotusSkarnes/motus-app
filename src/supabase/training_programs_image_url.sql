-- Programforsidebilde for bildekort under Mine programmer.
alter table public.training_programs add column if not exists image_url text;

comment on column public.training_programs.image_url is 'Valgfritt forsidebilde (URL). Tom = bruk første øvelses illustrasjon.';
