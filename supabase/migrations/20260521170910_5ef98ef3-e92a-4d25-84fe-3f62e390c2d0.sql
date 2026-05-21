-- ============================================
-- 1. TABLE event_plans
-- ============================================
CREATE TABLE public.event_plans (
  code text PRIMARY KEY,
  nom text NOT NULL,
  prix_cents integer NOT NULL DEFAULT 0,
  quota_mo integer NOT NULL,
  max_photos integer NOT NULL,
  max_invites integer,
  duree_jours integer NOT NULL,
  stripe_price_id text,
  is_top boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  description_courte text,
  description_usage text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_plans"
  ON public.event_plans FOR SELECT
  TO public
  USING (active = true);

INSERT INTO public.event_plans (code, nom, prix_cents, quota_mo, max_photos, max_invites, duree_jours, stripe_price_id, is_top, sort_order, description_courte, description_usage)
VALUES
  ('decouverte', 'Découverte',     0,     1024,  100,   10,    7, NULL,                       false, 1, '100 photos', 'Idéal pour tester ou un petit moment entre amis.'),
  ('essentiel',  'Essentiel',      2900,  6144,  500,   20,   30, 'plan_essentiel_onetime',   false, 2, '500 photos', 'Idéal pour un anniversaire ou une fête de famille.'),
  ('standard',   'Standard',       7900,  20480, 2000,  100,  30, 'plan_standard_onetime',    true,  3, '2 000 photos', 'Le plus choisi — parfait pour un mariage ou un événement pro.'),
  ('premium',    'Premium',        14900, 51200, 5000,  200,  30, 'plan_premium_onetime',     false, 4, '5 000 photos', 'Idéal pour un grand mariage ou un événement d''entreprise.'),
  ('illimitee',  'Illimitée',      19900, 204800, 1000000, NULL, 30, 'plan_illimitee_onetime', false, 5, 'Photos illimitées', 'Pour les festivals, gros événements ou plusieurs jours.');

-- ============================================
-- 2. EXTEND event_coupons
-- ============================================
ALTER TABLE public.event_coupons
  ADD COLUMN IF NOT EXISTS discount_percent integer CHECK (discount_percent IS NULL OR (discount_percent BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer CHECK (discount_amount_cents IS NULL OR discount_amount_cents >= 0);

-- Étendre validate_coupon pour retourner les infos de discount
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  RETURN jsonb_build_object(
    'valid', true,
    'type', _row.type,
    'discount_percent', _row.discount_percent,
    'discount_amount_cents', _row.discount_amount_cents
  );
END;
$function$;

-- ============================================
-- 3. EXTEND events
-- ============================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS plan_code text REFERENCES public.event_plans(code),
  ADD COLUMN IF NOT EXISTS paid_amount_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE;

-- ============================================
-- 4. TABLE pending_events
-- ============================================
CREATE TABLE public.pending_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE,
  email text NOT NULL,
  payload jsonb NOT NULL,
  plan_code text NOT NULL REFERENCES public.event_plans(code),
  paid_amount_cents integer NOT NULL DEFAULT 0,
  coupon_code text,
  consumed boolean NOT NULL DEFAULT false,
  created_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_events ENABLE ROW LEVEL SECURITY;
-- No public policies: only service role (server) accesses this table.

CREATE INDEX idx_pending_events_session ON public.pending_events(stripe_session_id);
CREATE INDEX idx_pending_events_email ON public.pending_events(email);

-- ============================================
-- 5. RPC create_event_from_pending
--    Appelé uniquement par le webhook côté serveur (service_role).
-- ============================================
CREATE OR REPLACE FUNCTION public.create_event_from_pending(
  _pending_id uuid,
  _stripe_session_id text,
  _paid_amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pending public.pending_events;
  _plan public.event_plans;
  _event_id uuid;
  _payload jsonb;
  _email text;
  _expire_at timestamptz;
  _existing_event_id uuid;
BEGIN
  -- Idempotence : si déjà consommé, renvoyer l'event existant
  SELECT * INTO _pending FROM public.pending_events WHERE id = _pending_id FOR UPDATE;
  IF _pending.id IS NULL THEN
    RAISE EXCEPTION 'pending_not_found';
  END IF;
  IF _pending.consumed AND _pending.created_event_id IS NOT NULL THEN
    SELECT jsonb_build_object('event_id', e.id, 'slug', e.slug, 'already_created', true)
      INTO _payload
      FROM public.events e WHERE e.id = _pending.created_event_id;
    RETURN _payload;
  END IF;

  -- Vérifier idempotence par stripe_session_id
  IF _stripe_session_id IS NOT NULL THEN
    SELECT id INTO _existing_event_id FROM public.events WHERE stripe_session_id = _stripe_session_id;
    IF _existing_event_id IS NOT NULL THEN
      UPDATE public.pending_events
        SET consumed = true, created_event_id = _existing_event_id
        WHERE id = _pending_id;
      SELECT jsonb_build_object('event_id', e.id, 'slug', e.slug, 'already_created', true)
        INTO _payload FROM public.events e WHERE e.id = _existing_event_id;
      RETURN _payload;
    END IF;
  END IF;

  SELECT * INTO _plan FROM public.event_plans WHERE code = _pending.plan_code;
  IF _plan.code IS NULL THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  _payload := _pending.payload;
  _email := lower(trim(_pending.email));

  _expire_at := COALESCE((_payload->>'event_date')::timestamptz, now()) + (_plan.duree_jours || ' days')::interval;

  INSERT INTO public.events (
    titre, slug, code_acces, event_date, lieu, cover_url, contact,
    status, commentaires_actifs, likes_actifs, uploads_actifs,
    quota_mo, expire_at, plan_code, paid_amount_cents, stripe_session_id
  ) VALUES (
    _payload->>'titre',
    _payload->>'slug',
    upper(_payload->>'code_acces'),
    (_payload->>'event_date')::timestamptz,
    _payload->>'lieu',
    NULLIF(_payload->>'cover_url', ''),
    _email,
    'active', true, true, true,
    _plan.quota_mo, _expire_at, _plan.code, _paid_amount_cents, _stripe_session_id
  ) RETURNING id INTO _event_id;

  INSERT INTO public.event_admins (event_id, email, role, added_by)
  VALUES (_event_id, _email, 'organisateur', NULL);

  -- Si coupon : marquer la redemption
  IF _pending.coupon_code IS NOT NULL AND length(_pending.coupon_code) > 0 THEN
    DECLARE _coupon_id uuid;
    BEGIN
      SELECT id INTO _coupon_id FROM public.event_coupons WHERE upper(code) = upper(_pending.coupon_code);
      IF _coupon_id IS NOT NULL THEN
        INSERT INTO public.event_coupon_redemptions (coupon_id, event_id, redeemed_by)
        VALUES (_coupon_id, _event_id, '00000000-0000-0000-0000-000000000000');
        UPDATE public.event_coupons SET uses_count = uses_count + 1 WHERE id = _coupon_id;
      END IF;
    END;
  END IF;

  UPDATE public.pending_events
    SET consumed = true, created_event_id = _event_id, stripe_session_id = COALESCE(stripe_session_id, _stripe_session_id)
    WHERE id = _pending_id;

  RETURN jsonb_build_object('event_id', _event_id, 'slug', _payload->>'slug', 'already_created', false);
END;
$function$;

-- Restreindre l'exécution : seuls postgres et service_role peuvent appeler create_event_from_pending
REVOKE EXECUTE ON FUNCTION public.create_event_from_pending(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_event_from_pending(uuid, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_event_from_pending(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_event_from_pending(uuid, text, integer) TO service_role;