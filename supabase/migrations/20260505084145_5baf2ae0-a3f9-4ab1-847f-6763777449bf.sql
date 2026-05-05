CREATE OR REPLACE FUNCTION public.update_own_invite(
  _device_id text,
  _event_id uuid,
  _avatar_url text DEFAULT NULL::text,
  _email text DEFAULT NULL::text,
  _rgpd_consent boolean DEFAULT NULL::boolean,
  _prenom text DEFAULT NULL::text
)
RETURNS invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.invites;
BEGIN
  IF _prenom IS NOT NULL AND (char_length(_prenom) < 1 OR char_length(_prenom) > 80) THEN
    RAISE EXCEPTION 'invalid_prenom_length';
  END IF;
  IF _email IS NOT NULL AND char_length(_email) > 255 THEN
    RAISE EXCEPTION 'invalid_email_length';
  END IF;

  UPDATE public.invites
  SET
    avatar_url = COALESCE(_avatar_url, avatar_url),
    email = COALESCE(_email, email),
    rgpd_consent = COALESCE(_rgpd_consent, rgpd_consent),
    prenom = COALESCE(_prenom, prenom)
  WHERE device_id = _device_id AND event_id = _event_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$function$;