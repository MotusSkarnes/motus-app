-- Supabase Storage setup for exercise image uploads
-- Run this in SQL Editor before using image upload in Exercise Bank.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-images',
  'exercise-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "exercise_images_public_read" on storage.objects;
create policy "exercise_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'exercise-images');

drop policy if exists "exercise_images_authenticated_upload" on storage.objects;
create policy "exercise_images_authenticated_upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'exercise-images');

drop policy if exists "exercise_images_authenticated_update" on storage.objects;
create policy "exercise_images_authenticated_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'exercise-images')
  with check (bucket_id = 'exercise-images');

drop policy if exists "exercise_images_authenticated_delete" on storage.objects;
create policy "exercise_images_authenticated_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'exercise-images');
