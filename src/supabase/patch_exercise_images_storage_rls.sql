-- Restrict exercise-images storage writes/deletes.
-- Previous policies allowed any authenticated user insert/update/delete on the whole
-- bucket, so knowing a victim email (deterministic member-avatars/email-<token>.jpg)
-- or listing prefixes enabled avatar overwrite and org-wide media wipe.
-- Kjør i Supabase SQL Editor.

create or replace function public.motus_storage_email_path_token(email text)
returns text
language sql
immutable
as $$
  select translate(
    rtrim(encode(convert_to(lower(trim(coalesce(email, ''))), 'UTF8'), 'base64'), '='),
    '+/',
    '-_'
  );
$$;

drop policy if exists "exercise_images_authenticated_upload" on storage.objects;
create policy "exercise_images_authenticated_upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (
      (
        (
          nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
        )
        and (
          name like 'exercise-bank/%'
          or name like 'food-bank/%'
          or name like 'program-covers/%'
          or name like 'inspiration/%'
          or name like 'member-avatars/%'
        )
      )
      or (
        name = 'member-avatars/email-'
          || public.motus_storage_email_path_token(auth.jwt() ->> 'email')
          || '.jpg'
      )
    )
  );

drop policy if exists "exercise_images_authenticated_update" on storage.objects;
create policy "exercise_images_authenticated_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'exercise-images'
    and (
      (
        (
          nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
        )
        and (
          name like 'exercise-bank/%'
          or name like 'food-bank/%'
          or name like 'program-covers/%'
          or name like 'inspiration/%'
          or name like 'member-avatars/%'
        )
      )
      or (
        name = 'member-avatars/email-'
          || public.motus_storage_email_path_token(auth.jwt() ->> 'email')
          || '.jpg'
      )
    )
  )
  with check (
    bucket_id = 'exercise-images'
    and (
      (
        (
          nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
        )
        and (
          name like 'exercise-bank/%'
          or name like 'food-bank/%'
          or name like 'program-covers/%'
          or name like 'inspiration/%'
          or name like 'member-avatars/%'
        )
      )
      or (
        name = 'member-avatars/email-'
          || public.motus_storage_email_path_token(auth.jwt() ->> 'email')
          || '.jpg'
      )
    )
  );

drop policy if exists "exercise_images_authenticated_delete" on storage.objects;
create policy "exercise_images_authenticated_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'exercise-images'
    and (
      (
        (
          nullif(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'trainer'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) like '%@motus-skarnes.no'
        )
        and (
          name like 'exercise-bank/%'
          or name like 'food-bank/%'
          or name like 'program-covers/%'
          or name like 'inspiration/%'
          or name like 'member-avatars/%'
        )
      )
      or (
        name = 'member-avatars/email-'
          || public.motus_storage_email_path_token(auth.jwt() ->> 'email')
          || '.jpg'
      )
    )
  );
