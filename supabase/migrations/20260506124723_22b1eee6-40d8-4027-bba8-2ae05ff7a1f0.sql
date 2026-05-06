-- 1) post_photos: tighten INSERT to require that the referenced post exists
DROP POLICY IF EXISTS anyone_can_create_post_photos ON public.post_photos;

CREATE POLICY anyone_can_create_post_photos
ON public.post_photos
FOR INSERT
TO public
WITH CHECK (
  ((url_miniature IS NULL) OR (char_length(url_miniature) <= 2048))
  AND ((url_medium IS NULL) OR (char_length(url_medium) <= 2048))
  AND ((url_full IS NULL) OR (char_length(url_full) <= 2048))
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_photos.post_id)
);

-- 2) Storage: explicit UPDATE/DELETE policies on event-photos bucket
--    Only authenticated event admins can modify or delete files.
DROP POLICY IF EXISTS "event_photos_admins_can_delete" ON storage.objects;
DROP POLICY IF EXISTS "event_photos_admins_can_update" ON storage.objects;

CREATE POLICY "event_photos_admins_can_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
  )
);

CREATE POLICY "event_photos_admins_can_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
  )
)
WITH CHECK (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
  )
);