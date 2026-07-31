alter table public.members
  add column if not exists archive_scheduled_for date;

create index if not exists members_archive_scheduled_for_idx
  on public.members (archive_scheduled_for)
  where archive_scheduled_for is not null and is_active is distinct from false;
