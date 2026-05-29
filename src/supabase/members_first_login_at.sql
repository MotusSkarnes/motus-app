-- Første innlogging (medlem har godtatt invitasjon og logget inn).
-- invited_at = kun når PT sender invitasjon (invite-member).
-- Kjør i Supabase SQL Editor før deploy av link-member-auth / hydrate.

alter table public.members add column if not exists first_login_at timestamptz;

comment on column public.members.first_login_at is
  'Tidspunkt medlem første gang koblet Supabase-auth og logget inn (link-member-auth).';

-- Heuristisk backfill for eksisterende aktive medlemmer (beholder invited_at uendret).
update public.members
set first_login_at = invited_at
where first_login_at is null
  and invited_at is not null
  and (
    coalesce(nullif(trim(days_since_activity), ''), '0')::int > 0
    or coalesce(personal_goals, '') ilike '%onboardingcompletedat%'
    or id::text like 'auth-%'
  );
