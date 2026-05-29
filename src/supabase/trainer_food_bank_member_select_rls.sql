-- Medlemmer kan lese PT sin matvarebank (søk/logging), ikke endre den.
drop policy if exists "trainer_food_bank_select_member_pt" on public.trainer_food_bank;
create policy "trainer_food_bank_select_member_pt"
  on public.trainer_food_bank
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.owner_user_id = trainer_food_bank.owner_user_id
        and (
          m.id = auth.uid()::text
          or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Medlemmer kan lese felles importerte matvarer.
drop policy if exists "shared_food_bank_items_select_members" on public.shared_food_bank_items;
create policy "shared_food_bank_items_select_members"
  on public.shared_food_bank_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = auth.uid()::text
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
