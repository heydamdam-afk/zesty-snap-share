
-- 1) Hide sensitive billing columns on events from client roles
REVOKE SELECT (stripe_session_id, paid_amount_cents) ON public.events FROM anon, authenticated;

-- 2) Hide guest auth identifiers on invites from anonymous (public) role
REVOKE SELECT (device_id, email) ON public.invites FROM anon;

-- 3) Tighten storage policies to require event_id match in object path
DROP POLICY IF EXISTS event_photos_admins_can_delete ON storage.objects;
DROP POLICY IF EXISTS event_photos_admins_can_update ON storage.objects;

CREATE POLICY event_photos_admins_can_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
      AND (
        ea.event_id::text = (storage.foldername(name))[1]
        OR (
          (storage.foldername(name))[1] = 'avatars'
          AND ea.event_id::text = (storage.foldername(name))[2]
        )
      )
  )
);

CREATE POLICY event_photos_admins_can_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
      AND (
        ea.event_id::text = (storage.foldername(name))[1]
        OR (
          (storage.foldername(name))[1] = 'avatars'
          AND ea.event_id::text = (storage.foldername(name))[2]
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE lower(ea.email) = public.current_admin_email()
      AND (
        ea.event_id::text = (storage.foldername(name))[1]
        OR (
          (storage.foldername(name))[1] = 'avatars'
          AND ea.event_id::text = (storage.foldername(name))[2]
        )
      )
  )
);
