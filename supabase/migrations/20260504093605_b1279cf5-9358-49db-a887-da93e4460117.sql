
-- Table de liaison entre utilisateurs auth (admins) et events qu'ils gèrent
CREATE TABLE public.event_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_admins ENABLE ROW LEVEL SECURITY;

-- Un user voit ses propres assignations admin
CREATE POLICY "users_can_read_own_admin_rows"
ON public.event_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Helper SECURITY DEFINER : vérifie si user est admin d'un event
CREATE OR REPLACE FUNCTION public.is_event_admin(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE event_id = _event_id AND user_id = _user_id
  );
$$;

-- Table des invités bannis
CREATE TABLE public.banned_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_id)
);

ALTER TABLE public.banned_invites ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire la liste des bannis (pour bloquer côté client)
CREATE POLICY "anyone_can_read_banned_invites"
ON public.banned_invites
FOR SELECT
TO public
USING (true);

-- RLS posts/commentaires/likes : DELETE par admin
CREATE POLICY "admins_can_delete_posts"
ON public.posts
FOR DELETE
TO authenticated
USING (public.is_event_admin(event_id, auth.uid()));

CREATE POLICY "admins_can_delete_commentaires"
ON public.commentaires
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = commentaires.photo_id
      AND public.is_event_admin(p.event_id, auth.uid())
  )
);

-- Admin peut bannir : insert dans banned_invites
CREATE POLICY "admins_can_ban_invites"
ON public.banned_invites
FOR INSERT
TO authenticated
WITH CHECK (public.is_event_admin(event_id, auth.uid()));

CREATE POLICY "admins_can_unban_invites"
ON public.banned_invites
FOR DELETE
TO authenticated
USING (public.is_event_admin(event_id, auth.uid()));

-- RPC : bannir un invité ET supprimer tous ses contenus
CREATE OR REPLACE FUNCTION public.ban_invite_cascade(_event_id uuid, _device_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_event_admin(_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- Insère le ban (idempotent)
  INSERT INTO public.banned_invites (event_id, device_id, banned_by)
  VALUES (_event_id, _device_id, auth.uid())
  ON CONFLICT (event_id, device_id) DO NOTHING;

  -- Supprime tous les posts de cet invité dans cet event
  DELETE FROM public.posts p
  USING public.invites i
  WHERE p.invite_id = i.id
    AND i.device_id = _device_id
    AND p.event_id = _event_id;

  -- Supprime ses commentaires sur les posts de cet event
  DELETE FROM public.commentaires c
  USING public.invites i, public.posts p
  WHERE c.invite_id = i.id
    AND i.device_id = _device_id
    AND c.photo_id = p.id
    AND p.event_id = _event_id;

  RETURN true;
END;
$$;
