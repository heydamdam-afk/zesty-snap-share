CREATE OR REPLACE FUNCTION public.create_event_with_coupon(_titre text, _slug text, _code_acces text, _event_date timestamp with time zone, _lieu text, _cover_url text, _contact text, _coupon_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _coupon public.event_coupons;
  _event_id uuid;
  _slug_clean text;
  _code_clean text;
  _expire_at timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = _user_id;
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'no_email';
  END IF;

  IF _titre IS NULL OR char_length(trim(_titre)) < 3 OR char_length(trim(_titre)) > 120 THEN
    RAISE EXCEPTION 'invalid_titre';
  END IF;
  _slug_clean := lower(trim(_slug));
  IF _slug_clean !~ '^[a-z0-9][a-z0-9-]{1,80}$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  _code_clean := upper(trim(_code_acces));
  IF _code_clean !~ '^[A-Z0-9]{4,20}$' THEN
    RAISE EXCEPTION 'invalid_code_acces';
  END IF;
  IF _event_date IS NULL OR _event_date < (now() - interval '1 day') THEN
    RAISE EXCEPTION 'invalid_event_date';
  END IF;
  IF _lieu IS NULL OR char_length(trim(_lieu)) < 1 OR char_length(trim(_lieu)) > 200 THEN
    RAISE EXCEPTION 'invalid_lieu';
  END IF;
  IF _contact IS NULL OR char_length(trim(_contact)) < 1 OR char_length(trim(_contact)) > 200 THEN
    RAISE EXCEPTION 'invalid_contact';
  END IF;
  IF _cover_url IS NOT NULL AND char_length(_cover_url) > 2048 THEN
    RAISE EXCEPTION 'invalid_cover_url';
  END IF;

  SELECT * INTO _coupon FROM public.event_coupons
  WHERE upper(code) = upper(trim(_coupon_code))
  FOR UPDATE;

  IF _coupon.id IS NULL THEN RAISE EXCEPTION 'coupon_invalid'; END IF;
  IF NOT _coupon.active THEN RAISE EXCEPTION 'coupon_inactive'; END IF;
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF _coupon.max_uses IS NOT NULL AND _coupon.uses_count >= _coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;

  IF EXISTS (SELECT 1 FROM public.events WHERE slug = _slug_clean) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE upper(code_acces) = _code_clean) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;

  _expire_at := COALESCE(_event_date, now()) + interval '30 days';

  INSERT INTO public.events (
    titre, slug, code_acces, event_date, lieu, cover_url, contact,
    status, commentaires_actifs, likes_actifs, uploads_actifs, quota_mo, expire_at
  ) VALUES (
    trim(_titre), _slug_clean, _code_clean, _event_date, trim(_lieu),
    NULLIF(_cover_url, ''), trim(_contact),
    'active', true, true, true, 6144, _expire_at
  ) RETURNING id INTO _event_id;

  INSERT INTO public.event_admins (event_id, user_id, email, role, added_by)
  VALUES (_event_id, _user_id, _user_email, 'organisateur', _user_id);

  INSERT INTO public.event_coupon_redemptions (coupon_id, event_id, redeemed_by)
  VALUES (_coupon.id, _event_id, _user_id);

  UPDATE public.event_coupons
  SET uses_count = uses_count + 1
  WHERE id = _coupon.id;

  RETURN jsonb_build_object(
    'event_id', _event_id,
    'slug', _slug_clean,
    'code_acces', _code_clean
  );
END;
$function$;