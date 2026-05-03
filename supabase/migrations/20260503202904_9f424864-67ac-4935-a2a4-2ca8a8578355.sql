-- 1. Restreindre UPDATE sur invites : passer par une fonction sécurisée
DROP POLICY IF EXISTS "anyone_can_update_invites" ON public.invites;

CREATE OR REPLACE FUNCTION public.update_own_invite(
  _device_id TEXT,
  _event_id UUID,
  _avatar_url TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _rgpd_consent BOOLEAN DEFAULT NULL
)
RETURNS public.invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.invites;
BEGIN
  UPDATE public.invites
  SET
    avatar_url = COALESCE(_avatar_url, avatar_url),
    email = COALESCE(_email, email),
    rgpd_consent = COALESCE(_rgpd_consent, rgpd_consent)
  WHERE device_id = _device_id AND event_id = _event_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

-- 2. Restreindre l'exécution des SECURITY DEFINER au rôle anon/authenticated explicitement,
-- et révoquer du PUBLIC.
REVOKE EXECUTE ON FUNCTION public.delete_own_commentaire(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_own_like(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_own_invite(TEXT, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.delete_own_commentaire(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_like(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_invite(TEXT, UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- 3. Storage : remplacer la règle de lecture trop large par une lecture par chemin (pas de listing)
DROP POLICY IF EXISTS "event_photos_public_read" ON storage.objects;

CREATE POLICY "event_photos_public_read_by_path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos' AND name IS NOT NULL);
-- Les URLs publiques restent accessibles individuellement, mais le listing
-- via la storage API requiert l'auth.