-- Align SELECT policies with JWT member_id in app_metadata OR user_metadata (client sync / RLS).
drop policy if exists "chat_messages_select_trainer_or_member" on public.chat_messages;
create policy "chat_messages_select_trainer_or_member"
  on public.chat_messages
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.members m
      where m.id = chat_messages.member_id
        and m.owner_user_id = auth.uid()
    )
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
  );

drop policy if exists "training_programs_select_trainer_or_member" on public.training_programs;
create policy "training_programs_select_trainer_or_member"
  on public.training_programs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = training_programs.member_id
        and lower(trim(m.customer_type)) = 'medlem'
        and (
          auth.jwt() -> 'app_metadata' ->> 'role' = 'trainer'
          or auth.jwt() -> 'user_metadata' ->> 'role' = 'trainer'
        )
    )
  );

drop policy if exists "workout_logs_select_trainer_or_member" on public.workout_logs;
create policy "workout_logs_select_trainer_or_member"
  on public.workout_logs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
  );

drop policy if exists "member_period_plans_select_trainer_or_member" on public.member_period_plans;
create policy "member_period_plans_select_trainer_or_member"
  on public.member_period_plans
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or member_id = nullif(auth.jwt() -> 'user_metadata' ->> 'member_id', '')
  );
