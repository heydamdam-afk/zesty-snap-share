-- Posts table
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_initials TEXT,
  avatar_url TEXT,
  text TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX posts_event_id_created_at_idx ON public.posts (event_id, created_at DESC);

-- Post photos table
CREATE TABLE public.post_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX post_photos_post_id_idx ON public.post_photos (post_id);
CREATE INDEX post_photos_event_id_idx ON public.post_photos (event_id);

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_photos ENABLE ROW LEVEL SECURITY;

-- Posts policies (public gallery by event code)
CREATE POLICY "anyone_can_read_posts"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "anyone_can_create_posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    char_length(device_id) BETWEEN 8 AND 128
    AND char_length(author_name) BETWEEN 1 AND 80
    AND char_length(event_id) BETWEEN 1 AND 64
  );

-- Post photos policies
CREATE POLICY "anyone_can_read_post_photos"
  ON public.post_photos FOR SELECT
  USING (true);

CREATE POLICY "anyone_can_create_post_photos"
  ON public.post_photos FOR INSERT
  WITH CHECK (
    char_length(url) BETWEEN 1 AND 2048
    AND char_length(event_id) BETWEEN 1 AND 64
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_photos;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_photos REPLICA IDENTITY FULL;