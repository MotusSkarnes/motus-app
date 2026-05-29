-- La medlemmer redigere egne ventende matvareforslag.
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
