-- PT kan gi enkeltkunder tilgang til ernæring (matplan i medlems-app).
alter table public.members add column if not exists nutrition_access boolean not null default false;

comment on column public.members.nutrition_access is 'Medlem ser fanen Ernæring og matplan fra PT når true.';
