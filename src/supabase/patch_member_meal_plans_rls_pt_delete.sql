-- PT skal kunne slette matplan for egne kunder (samme tilgang som lesing).
-- Kjør i Supabase SQL Editor etter patch_member_meal_plans_rls_pt_via_members.sql.

drop policy if exists "member_meal_plans_delete_own" on public.member_meal_plans;
drop policy if exists "member_meal_plans_delete" on public.member_meal_plans;

create policy "member_meal_plans_delete"
  on public.member_meal_plans
  for delete
  to authenticated
  using (
    auth.uid() = owner_user_id
    or exists (
      select 1
      from public.members m
      where m.id::text = member_meal_plans.member_id
        and m.owner_user_id = auth.uid()
    )
  );
