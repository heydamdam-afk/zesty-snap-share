-- Drop old tables
DROP TABLE IF EXISTS public.post_photos CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;

-- ============= EVENTS =============
CREATE TYPE public.event_status AS ENUM ('active', 'expired', 'archived');

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  code_acces TEXT NOT NULL,
  status public.event_status NOT NULL DEFAULT 'active',
  expire_at TIMESTAMPTZ,
  commentaires_actifs BOOLEAN NOT NULL DEFAULT true,
  likes_actifs BOOLEAN NOT NULL DEFAULT true,
  telechargement_actif BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_slug_idx ON public.events (slug);
CREATE INDEX events_code_acces_idx ON public.events (code_acces);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_events"
  ON public.events FOR SELECT USING (true);

-- ============= INVITES =============
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL,
  email TEXT,
  device_id TEXT NOT NULL,
  avatar_url TEXT,
  rgpd_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_id)
);

CREATE INDEX invites_event_id_idx ON public.invites (event_id);
CREATE INDEX invites_device_id_idx ON public.invites (device_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_invites"
  ON public.invites FOR SELECT USING (true);

CREATE POLICY "anyone_can_create_invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    char_length(prenom) BETWEEN 1 AND 80
    AND char_length(device_id) BETWEEN 8 AND 128
    AND (email IS NULL OR char_length(email) <= 255)
  );

CREATE POLICY "anyone_can_update_invites"
  ON public.invites FOR UPDATE USING (true);

-- ============= POSTS =============
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invite_id UUID NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  contenu_texte TEXT,
  url_miniature TEXT,
  url_medium TEXT,
  url_full TEXT,
  nb_likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (contenu_texte IS NOT NULL OR url_miniature IS NOT NULL)
);

CREATE INDEX posts_event_created_idx ON public.posts (event_id, created_at DESC);
CREATE INDEX posts_invite_idx ON public.posts (invite_id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts REPLICA IDENTITY FULL;

CREATE POLICY "anyone_can_read_posts"
  ON public.posts FOR SELECT USING (true);

CREATE POLICY "anyone_can_create_posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    (contenu_texte IS NULL OR char_length(contenu_texte) <= 2000)
    AND (url_miniature IS NULL OR char_length(url_miniature) <= 2048)
    AND (url_medium IS NULL OR char_length(url_medium) <= 2048)
    AND (url_full IS NULL OR char_length(url_full) <= 2048)
  );

-- ============= COMMENTAIRES =============
CREATE TABLE public.commentaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  invite_id UUID NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX commentaires_photo_idx ON public.commentaires (photo_id, created_at);

ALTER TABLE public.commentaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commentaires REPLICA IDENTITY FULL;

CREATE POLICY "anyone_can_read_commentaires"
  ON public.commentaires FOR SELECT USING (true);

CREATE POLICY "anyone_can_create_commentaires"
  ON public.commentaires FOR INSERT
  WITH CHECK (char_length(contenu) BETWEEN 1 AND 1000);

-- Suppression de son propre commentaire : via security definer fn vérifiant device_id
CREATE OR REPLACE FUNCTION public.delete_own_commentaire(_commentaire_id UUID, _device_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok BOOLEAN;
BEGIN
  DELETE FROM public.commentaires c
  USING public.invites i
  WHERE c.id = _commentaire_id
    AND c.invite_id = i.id
    AND i.device_id = _device_id;
  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok;
END;
$$;

-- ============= LIKES =============
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  invite_id UUID NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (photo_id, invite_id)
);

CREATE INDEX likes_photo_idx ON public.likes (photo_id);
CREATE INDEX likes_invite_idx ON public.likes (invite_id);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes REPLICA IDENTITY FULL;

CREATE POLICY "anyone_can_read_likes"
  ON public.likes FOR SELECT USING (true);

CREATE POLICY "anyone_can_create_likes"
  ON public.likes FOR INSERT WITH CHECK (true);

-- Unlike via security definer fn vérifiant device_id
CREATE OR REPLACE FUNCTION public.delete_own_like(_photo_id UUID, _device_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok BOOLEAN;
BEGIN
  DELETE FROM public.likes l
  USING public.invites i
  WHERE l.photo_id = _photo_id
    AND l.invite_id = i.id
    AND i.device_id = _device_id;
  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok;
END;
$$;

-- ============= TRIGGER nb_likes =============
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET nb_likes = nb_likes + 1 WHERE id = NEW.photo_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET nb_likes = GREATEST(nb_likes - 1, 0) WHERE id = OLD.photo_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commentaires;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "event_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos');

CREATE POLICY "event_photos_anyone_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-photos');