
CREATE TABLE public.addon_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  addon_type text NOT NULL DEFAULT 'addon_images',
  photos_added integer NOT NULL DEFAULT 100,
  days_extended integer NOT NULL DEFAULT 30,
  paid_amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_addon_purchases_event ON public.addon_purchases(event_id);

ALTER TABLE public.addon_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_read_addon_purchases ON public.addon_purchases
  FOR SELECT TO authenticated
  USING (public.is_event_admin_email(event_id));

CREATE POLICY service_role_manage_addon_purchases ON public.addon_purchases
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.event_addon_count(_event_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.addon_purchases
  WHERE event_id = _event_id AND addon_type = 'addon_images';
$$;

CREATE OR REPLACE FUNCTION public.event_max_photos(_event_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(p.max_photos, 0) + COALESCE(public.event_addon_count(_event_id), 0) * 100
  FROM public.events e
  LEFT JOIN public.event_plans p ON p.code = e.plan_code
  WHERE e.id = _event_id;
$$;

CREATE OR REPLACE FUNCTION public.apply_addon_images(
  _event_id uuid,
  _stripe_session_id text,
  _paid_amount_cents integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _event public.events;
  _existing uuid;
  _count int;
  _new_expire timestamptz;
BEGIN
  -- Idempotence
  SELECT id INTO _existing FROM public.addon_purchases
  WHERE stripe_session_id = _stripe_session_id;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('already_applied', true, 'purchase_id', _existing);
  END IF;

  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF _event.plan_code IS DISTINCT FROM 'decouverte' THEN
    RAISE EXCEPTION 'addon_only_for_decouverte';
  END IF;

  SELECT public.event_addon_count(_event_id) INTO _count;
  IF _count >= 3 THEN
    RAISE EXCEPTION 'addon_limit_reached';
  END IF;

  _new_expire := GREATEST(COALESCE(_event.expire_at, now()), now() + interval '30 days');

  UPDATE public.events
  SET expire_at = _new_expire
  WHERE id = _event_id;

  INSERT INTO public.addon_purchases (event_id, stripe_session_id, photos_added, days_extended, paid_amount_cents)
  VALUES (_event_id, _stripe_session_id, 100, 30, _paid_amount_cents)
  RETURNING id INTO _existing;

  RETURN jsonb_build_object(
    'already_applied', false,
    'purchase_id', _existing,
    'new_expire_at', _new_expire,
    'addon_count', _count + 1,
    'max_photos', public.event_max_photos(_event_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.event_addon_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_max_photos(uuid) TO anon, authenticated;
