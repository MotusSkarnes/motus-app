-- Treningsgrupper + gruppechat.
-- Isolert fra chat_messages og 1:1 PT-chat. Kjør i Supabase SQL Editor.
-- Vercel kjører ikke SQL automatisk.

create table if not exists public.training_groups (
  id text primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_program_id text,
  master_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_group_members (
  group_id text not null references public.training_groups (id) on delete cascade,
  member_id text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

create table if not exists public.group_chat_messages (
  id text primary key,
  group_id text not null references public.training_groups (id) on delete cascade,
  sender_role text not null check (sender_role in ('trainer', 'member')),
  sender_member_id text,
  sender_name text not null default '',
  text text not null,
  created_at timestamptz not null default now(),
  owner_user_id uuid not null references auth.users (id) on delete cascade
);

create index if not exists training_groups_owner_idx
  on public.training_groups (owner_user_id, updated_at desc);

create index if not exists training_group_members_member_idx
  on public.training_group_members (member_id);

create index if not exists group_chat_messages_group_idx
  on public.group_chat_messages (group_id, created_at);

alter table public.training_groups enable row level security;
alter table public.training_group_members enable row level security;
alter table public.group_chat_messages enable row level security;

drop policy if exists "training_groups_select" on public.training_groups;
create policy "training_groups_select"
  on public.training_groups
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.training_group_members gm
      where gm.group_id = training_groups.id
        and (
          gm.member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or exists (
            select 1
            from public.members m
            where m.id = gm.member_id
              and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
              and coalesce(m.is_active, true) is not false
          )
        )
    )
  );

drop policy if exists "training_groups_mutate_owner" on public.training_groups;
create policy "training_groups_mutate_owner"
  on public.training_groups
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "training_group_members_select" on public.training_group_members;
create policy "training_group_members_select"
  on public.training_group_members
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = training_group_members.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  );

drop policy if exists "training_group_members_mutate_owner" on public.training_group_members;
create policy "training_group_members_mutate_owner"
  on public.training_group_members
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "group_chat_messages_select" on public.group_chat_messages;
create policy "group_chat_messages_select"
  on public.group_chat_messages
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.training_group_members gm
      where gm.group_id = group_chat_messages.group_id
        and (
          gm.member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
          or exists (
            select 1
            from public.members m
            where m.id = gm.member_id
              and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
              and coalesce(m.is_active, true) is not false
          )
        )
    )
  );

drop policy if exists "group_chat_messages_insert" on public.group_chat_messages;
create policy "group_chat_messages_insert"
  on public.group_chat_messages
  for insert
  to authenticated
  with check (
    (
      -- Trainer messages must come from the group owner. owner_user_id = auth.uid()
      -- alone lets any authenticated user forge sender_role = 'trainer' into any group.
      owner_user_id = auth.uid()
      and sender_role = 'trainer'
      and sender_member_id is null
      and exists (
        select 1
        from public.training_groups g
        where g.id = group_chat_messages.group_id
          and g.owner_user_id = auth.uid()
      )
    )
    or (
      sender_role = 'member'
      and sender_member_id is not null
      and exists (
        select 1
        from public.training_group_members gm
        where gm.group_id = group_chat_messages.group_id
          and gm.member_id = group_chat_messages.sender_member_id
          and (
            gm.member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
            or exists (
              select 1
              from public.members m
              where m.id = gm.member_id
                and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
                and coalesce(m.is_active, true) is not false
            )
          )
      )
    )
  );

-- Ukeplan per treningsgruppe (kjør også alene hvis tabellen allerede finnes).
alter table public.training_groups
  add column if not exists source_period_plan_id text;

alter table public.training_groups
  add column if not exists master_period_plan jsonb;

-- Nivå 1–3 og PT-preferanser per gruppe (kjør også alene hvis tabellen allerede finnes).
alter table public.training_groups
  add column if not exists level_setup jsonb;
