-- Fjerner user_metadata fra RLS (brukere kan endre det selv — utrygt i sikkerhetskontekst).
-- Medlem får tilgang via app_metadata.member_id (satt av server) eller e-postkobling i members-tabellen.
-- Kjør i Supabase SQL Editor.

drop policy if exists "member_period_plans_select_trainer_or_member" on public.member_period_plans;

create policy "member_period_plans_select_trainer_or_member"
  on public.member_period_plans
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or member_id = nullif(auth.jwt() -> 'app_metadata' ->> 'member_id', '')
    or exists (
      select 1
      from public.members m
      where m.id = member_period_plans.member_id
        and lower(trim(coalesce(m.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce(m.is_active, true) is not false
    )
  );
