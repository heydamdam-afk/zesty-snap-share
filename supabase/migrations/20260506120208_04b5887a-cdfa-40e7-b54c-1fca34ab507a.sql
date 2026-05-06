
-- ============================================================
-- 1) INVITES: hide sensitive columns from public, expose via RPC
-- ============================================================

-- Revoke direct SELECT on sensitive columns; keep displayable columns public.
REVOKE SELECT ON public.invites FROM anon, authenticated;
GRANT SELECT (id, event_id, prenom, avatar_url, created_at) ON public.invites TO anon, authenticated;

-- RPC: a guest can fetch their own invite by proving the device_id.
CREATE OR REPLACE FUNCTION public.find_my_invite(_event_id uuid, _device_id text)
RETURNS public.invites
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.invites
  WHERE event_id = _event_id AND device_id = _device_id
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.find_my_invite(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_my_invite(uuid, text) TO anon, authenticated;

-- RPC: check if a device is banned for an event (used during login).
CREATE OR REPLACE FUNCTION public.is_device_banned(_event_id uuid, _device_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.banned_invites
    WHERE event_id = _event_id AND device_id = _device_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_device_banned(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_device_banned(uuid, text) TO anon, authenticated;

-- ============================================================
-- 2) BANNED_INVITES: SELECT admin only
-- ============================================================
DROP POLICY IF EXISTS anyone_can_read_banned_invites ON public.banned_invites;

CREATE POLICY "admins_can_read_banned_invites"
ON public.banned_invites FOR SELECT TO authenticated
USING (public.is_event_admin_email(event_id));

-- ============================================================
-- 3) EVENT_BANS: SELECT admin only
-- ============================================================
DROP POLICY IF EXISTS anyone_can_read_event_bans ON public.event_bans;

CREATE POLICY "admins_can_read_event_bans"
ON public.event_bans FOR SELECT TO authenticated
USING (public.is_event_admin_email(event_id));

-- ============================================================
-- 4) EVENTS: remove anon UPDATE (n8n uses an auth'd endpoint now)
-- ============================================================
DROP POLICY IF EXISTS anon_can_transition_event_status ON public.events;
