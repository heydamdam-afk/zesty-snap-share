ALTER TABLE public.posts ADD COLUMN gallery_only boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS posts_feed_idx ON public.posts (event_id, created_at DESC) WHERE gallery_only = false;