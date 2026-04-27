-- Web Push subscriptions (one row per browser endpoint). Inserts only via Edge Function (service role).
-- Run in Supabase SQL editor or migrate after review.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- No policies: only service role (Edge Functions) may read/write.

comment on table public.push_subscriptions is 'Web Push endpoints; populated by register-push-subscription Edge Function.';
