
-- 1. New table for multiple photos per post
CREATE TABLE public.post_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  url_miniature TEXT,
  url_medium TEXT,
  url_full TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT post_photos_position_range CHECK (position >= 0 AND position <= 3),
  CONSTRAINT post_photos_unique_position UNIQUE (post_id, position)
);

CREATE INDEX idx_post_photos_post_id ON public.post_photos(post_id);

ALTER TABLE public.post_photos ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "anyone_can_read_post_photos"
  ON public.post_photos FOR SELECT
  USING (true);

-- Public insert (matching posts insert policy)
CREATE POLICY "anyone_can_create_post_photos"
  ON public.post_photos FOR INSERT
  WITH CHECK (
    (url_miniature IS NULL OR char_length(url_miniature) <= 2048)
    AND (url_medium IS NULL OR char_length(url_medium) <= 2048)
    AND (url_full IS NULL OR char_length(url_full) <= 2048)
  );

-- Admins can delete photos of their event
CREATE POLICY "admins_can_delete_post_photos"
  ON public.post_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_photos.post_id
        AND public.is_event_admin(p.event_id, auth.uid())
    )
  );

-- 2. Migrate legacy single-photo data into post_photos
INSERT INTO public.post_photos (post_id, position, url_miniature, url_medium, url_full)
SELECT id, 0, url_miniature, url_medium, url_full
FROM public.posts
WHERE url_full IS NOT NULL OR url_medium IS NOT NULL OR url_miniature IS NOT NULL;

-- 3. Function for owner-deletion of an entire post (cascade includes post_photos)
-- Already handled by deletePostWithR2 server fn — no changes needed.
