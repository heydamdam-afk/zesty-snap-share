-- RPC: find an existing invite for an event by email (case-insensitive),
-- and adopt the current device_id if it differs (so the guest is recognised
-- across devices using their email as primary identifier).
CREATE OR REPLACE FUNCTION public.find_or_adopt_invite_by_email(
  _event_id uuid,
  _email text,
  _device_id text
)
RETURNS public.invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.invites;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN NULL;
  END IF;
  IF _device_id IS NULL OR length(_device_id) < 8 THEN
    RAISE EXCEPTION 'invalid_device_id';
  END IF;

  SELECT * INTO _row
  FROM public.invites
  WHERE event_id = _event_id
    AND lower(email) = lower(trim(_email))
  ORDER BY created_at ASC
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- If the guest comes back from a different device, adopt the new device_id
  -- so subsequent device-scoped RPCs (find_my_invite, delete_own_*, etc.) work.
  IF _row.device_id IS DISTINCT FROM _device_id THEN
    -- Only adopt if the new device isn't banned
    IF EXISTS (
      SELECT 1 FROM public.banned_invites
      WHERE event_id = _event_id AND device_id = _device_id
    ) THEN
      RAISE EXCEPTION 'device_banned';
    END IF;
    UPDATE public.invites
      SET device_id = _device_id
      WHERE id = _row.id
      RETURNING * INTO _row;
  END IF;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_adopt_invite_by_email(uuid, text, text) TO anon, authenticated;