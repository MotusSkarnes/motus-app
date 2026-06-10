-- La alle trenere lese programmer på delte Medlem-kunder (customer_type = Medlem).
-- Foretrukket: kjør src/supabase/production_stability_patch.sql (samme policy + mer).
-- Denne filen beholdes for enkeltsteg-deploy hvis patch allerede er delvis kjørt.

drop policy if exists "training_programs_select_trainer_or_member" on public.training_programs;
create policy "training_programs_select_trainer_or_member"
  on public.training_programs
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = training_programs.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
    or exists (
      select 1
      from public.members m
      where m.id = training_programs.member_id
        and lower(trim(m.customer_type)) = 'medlem'
        and lower(trim(coalesce(m.membership_type, ''))) <> 'premium'
        and (
          nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
        )
    )
  );
