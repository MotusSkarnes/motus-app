-- Delt inspirasjonsfeed for alle innloggede (PT publiserer, medlemmer leser).
create table if not exists public.inspiration_feed (
  id text primary key default 'shared',
  items jsonb not null default '[]'::jsonb,
  suppressed_item_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.inspiration_feed
  add column if not exists suppressed_item_ids jsonb not null default '[]'::jsonb;

alter table public.inspiration_feed enable row level security;

drop policy if exists "inspiration_feed_read_authenticated" on public.inspiration_feed;
create policy "inspiration_feed_read_authenticated"
  on public.inspiration_feed
  for select
  to authenticated
  using (true);

drop policy if exists "inspiration_feed_write_authenticated" on public.inspiration_feed;
create policy "inspiration_feed_write_authenticated"
  on public.inspiration_feed
  for all
  to authenticated
  using (true)
  with check (true);

insert into public.inspiration_feed (id, items)
values ('shared', '[]'::jsonb)
on conflict (id) do nothing;
