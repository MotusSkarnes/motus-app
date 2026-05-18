-- Synk inspirasjon (innlegg + skjulte standard-artikler) på tvers av enheter.
-- Kjør i Supabase SQL Editor etter inspiration_feed_schema.sql.

alter table public.inspiration_feed
  add column if not exists suppressed_item_ids jsonb not null default '[]'::jsonb;
