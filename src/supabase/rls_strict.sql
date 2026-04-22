-- Strict RLS setup for authenticated users.
-- Run AFTER moving to Supabase Auth and validating owner mapping.

alter table public.members
  add column if not exists owner_user_id uuid default auth.uid();
update public.members set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.members alter column owner_user_id set not null;

alter table public.chat_messages
  add column if not exists owner_user_id uuid default auth.uid();
update public.chat_messages set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.chat_messages alter column owner_user_id set not null;

alter table public.training_programs
  add column if not exists owner_user_id uuid default auth.uid();
update public.training_programs set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.training_programs alter column owner_user_id set not null;

alter table public.workout_logs
  add column if not exists owner_user_id uuid default auth.uid();
update public.workout_logs set owner_user_id = coalesce(owner_user_id, auth.uid());
alter table public.workout_logs alter column owner_user_id set not null;

drop policy if exists "members_select_dev" on public.members;
drop policy if exists "members_insert_dev" on public.members;
drop policy if exists "members_update_dev" on public.members;
create policy "members_select_own"
  on public.members
  for select to authenticated
  using (owner_user_id = auth.uid());
create policy "members_insert_own"
  on public.members
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "members_update_own"
  on public.members
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "chat_messages_select_dev" on public.chat_messages;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_dev" on public.chat_messages;
create policy "chat_messages_select_trainer_or_member"
  on public.chat_messages
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "training_programs_select_dev" on public.training_programs;
drop policy if exists "training_programs_select_own" on public.training_programs;
drop policy if exists "training_programs_insert_dev" on public.training_programs;
drop policy if exists "training_programs_update_dev" on public.training_programs;
drop policy if exists "training_programs_delete_dev" on public.training_programs;
create policy "training_programs_select_trainer_or_member"
  on public.training_programs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "training_programs_insert_own"
  on public.training_programs
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "training_programs_update_own"
  on public.training_programs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "training_programs_delete_own"
  on public.training_programs
  for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "workout_logs_select_dev" on public.workout_logs;
drop policy if exists "workout_logs_select_own" on public.workout_logs;
drop policy if exists "workout_logs_insert_dev" on public.workout_logs;
drop policy if exists "workout_logs_update_dev" on public.workout_logs;
drop policy if exists "workout_logs_delete_dev" on public.workout_logs;
create policy "workout_logs_select_trainer_or_member"
  on public.workout_logs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
  );
create policy "workout_logs_insert_own"
  on public.workout_logs
  for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "workout_logs_update_own"
  on public.workout_logs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "workout_logs_delete_own"
  on public.workout_logs
  for delete to authenticated
  using (owner_user_id = auth.uid());
