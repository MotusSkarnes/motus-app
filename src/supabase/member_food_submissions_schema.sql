-- Forslag til nye matvarer fra medlemmer (PT godkjenner).
create table if not exists public.member_food_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  member_name text,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  draft_item jsonb not null,
  label_image_url text,
  review_note text,
  approved_food_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_food_submissions_owner_status_idx
  on public.member_food_submissions (owner_user_id, status, created_at desc);

create index if not exists member_food_submissions_member_idx
  on public.member_food_submissions (member_id, created_at desc);

alter table public.member_food_submissions enable row level security;

drop policy if exists "member_food_submissions_select_member" on public.member_food_submissions;
create policy "member_food_submissions_select_member"
  on public.member_food_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          m.id = auth.uid()::text
          or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

drop policy if exists "member_food_submissions_insert_member" on public.member_food_submissions;
create policy "member_food_submissions_insert_member"
  on public.member_food_submissions
  for insert
  to authenticated
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.members m
      where m.id = member_id
        and m.owner_user_id = owner_user_id
        and (
          m.id = auth.uid()::text
          or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

drop policy if exists "member_food_submissions_select_trainer" on public.member_food_submissions;
create policy "member_food_submissions_select_trainer"
  on public.member_food_submissions
  for select
  to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "member_food_submissions_update_trainer" on public.member_food_submissions;
create policy "member_food_submissions_update_trainer"
  on public.member_food_submissions
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "member_food_submissions_update_member" on public.member_food_submissions;
create policy "member_food_submissions_update_member"
  on public.member_food_submissions
  for update
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          m.id = auth.uid()::text
          or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  )
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.members m
      where m.id = member_id
        and (
          m.id = auth.uid()::text
          or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
