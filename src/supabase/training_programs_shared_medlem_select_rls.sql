-- La alle trenere lese programmer på delte Medlem-kunder (customer_type = Medlem).
-- Kjør i Supabase SQL Editor etter deploy av hydrate-trainer-data.

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
