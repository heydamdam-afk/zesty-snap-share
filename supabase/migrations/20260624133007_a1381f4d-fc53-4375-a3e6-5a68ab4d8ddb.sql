CREATE OR REPLACE FUNCTION public.get_expiring_events_in_days(_days integer)
RETURNS TABLE(
  event_id uuid,
  titre text,
  slug text,
  expire_at timestamptz,
  owner_email text,
  owner_prenom text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id,
    e.titre,
    e.slug,
    e.expire_at,
    lower(ea.email) AS owner_email,
    COALESCE(p.prenom, ea.prenom) AS owner_prenom
  FROM public.events e
  JOIN public.event_admins ea
    ON ea.event_id = e.id AND ea.role = 'organisateur'
  LEFT JOIN public.profiles p
    ON lower(p.email) = lower(ea.email)
  WHERE e.status = 'active'
    AND e.expire_at IS NOT NULL
    AND (e.expire_at AT TIME ZONE 'UTC')::date
        = ((now() + make_interval(days => _days)) AT TIME ZONE 'UTC')::date;
$$;

REVOKE ALL ON FUNCTION public.get_expiring_events_in_days(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_events_in_days(integer) TO service_role;