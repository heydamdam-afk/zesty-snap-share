-- ============================================================
-- 1. Table platform_admins (super admins Kapsul)
-- ============================================================
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check platform admin status (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  );
$$;

CREATE POLICY "platform_admins_self_read"
ON public.platform_admins FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- ============================================================
-- 2. Table event_coupons
-- ============================================================
CREATE TABLE public.event_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'free_event',
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  note text
);

ALTER TABLE public.event_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_manage_coupons_select"
ON public.event_coupons FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_manage_coupons_insert"
ON public.event_coupons FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_manage_coupons_update"
ON public.event_coupons FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_manage_coupons_delete"
ON public.event_coupons FOR DELETE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 3. Table event_coupon_redemptions
-- ============================================================
CREATE TABLE public.event_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.event_coupons(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  redeemed_by uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_read_redemptions"
ON public.event_coupon_redemptions FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 4. Public coupon validation (no table exposure)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.event_coupons;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;

  SELECT * INTO _row FROM public.event_coupons
  WHERE upper(code) = upper(trim(_code))
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF NOT _row.active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  IF _row.max_uses IS NOT NULL AND _row.uses_count >= _row.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'exhausted');
  END IF;

  RETURN jsonb_build_object('valid', true, 'type', _row.type);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO authenticated, anon;

-- ============================================================
-- 5. Allow events INSERT via security definer RPC only
--    (events table currently has no INSERT policy — keep that)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_event_with_coupon(
  _titre text,
  _slug text,
  _code_acces text,
  _event_date timestamptz,
  _lieu text,
  _cover_url text,
  _contact text,
  _coupon_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _coupon public.event_coupons;
  _event_id uuid;
  _slug_clean text;
  _code_clean text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = _user_id;
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'no_email';
  END IF;

  -- Input validation
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

  -- Lock + validate coupon
  SELECT * INTO _coupon FROM public.event_coupons
  WHERE upper(code) = upper(trim(_coupon_code))
  FOR UPDATE;

  IF _coupon.id IS NULL THEN
    RAISE EXCEPTION 'coupon_invalid';
  END IF;
  IF NOT _coupon.active THEN
    RAISE EXCEPTION 'coupon_inactive';
  END IF;
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF _coupon.max_uses IS NOT NULL AND _coupon.uses_count >= _coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;

  -- Slug & code unicity
  IF EXISTS (SELECT 1 FROM public.events WHERE slug = _slug_clean) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE upper(code_acces) = _code_clean) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;

  -- Insert event
  INSERT INTO public.events (
    titre, slug, code_acces, event_date, lieu, cover_url, contact,
    status, commentaires_actifs, likes_actifs, uploads_actifs, quota_mo
  ) VALUES (
    trim(_titre), _slug_clean, _code_clean, _event_date, trim(_lieu),
    NULLIF(_cover_url, ''), trim(_contact),
    'active', true, true, true, 6144
  ) RETURNING id INTO _event_id;

  -- Make creator the organisateur
  INSERT INTO public.event_admins (event_id, user_id, email, role, added_by)
  VALUES (_event_id, _user_id, _user_email, 'organisateur', _user_id);

  -- Record redemption + bump counter
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
$$;

REVOKE ALL ON FUNCTION public.create_event_with_coupon(text,text,text,timestamptz,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_event_with_coupon(text,text,text,timestamptz,text,text,text,text) TO authenticated;

-- ============================================================
-- 6. Helper RPC: list current user's events (for landing redirect)
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_admin_events()
RETURNS TABLE (event_id uuid, slug text, titre text, role admin_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.slug, e.titre, ea.role
  FROM public.event_admins ea
  JOIN public.events e ON e.id = ea.event_id
  WHERE lower(ea.email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
  ORDER BY e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_admin_events() FROM public;
GRANT EXECUTE ON FUNCTION public.my_admin_events() TO authenticated;