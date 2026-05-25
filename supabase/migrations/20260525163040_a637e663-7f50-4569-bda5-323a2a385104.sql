-- 1. Revoke public access to sensitive columns on events
REVOKE SELECT (contact, stripe_session_id, paid_amount_cents)
  ON public.events FROM anon, authenticated;

-- 2. RPC to fetch the organiser contact for a single event (callable by anyone)
CREATE OR REPLACE FUNCTION public.get_event_contact(_event_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT contact FROM public.events WHERE id = _event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_contact(uuid) TO anon, authenticated;

-- 3. Tighten storage upload policy on event-photos bucket
DROP POLICY IF EXISTS event_photos_anyone_upload ON storage.objects;

CREATE POLICY event_photos_anyone_upload
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'event-photos'
    AND name IS NOT NULL
    AND (
      -- Standard photo path: <event_id>/...
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id::text = (storage.foldername(name))[1]
          AND e.status = 'active'
          AND e.uploads_actifs = true
      )
      OR
      -- Avatar path: avatars/<event_id>/...
      (
        (storage.foldername(name))[1] = 'avatars'
        AND EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id::text = (storage.foldername(name))[2]
        )
      )
    )
  );
