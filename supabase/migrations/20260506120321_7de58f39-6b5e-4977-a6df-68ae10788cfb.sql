
-- Restore device_id read access (needed by UI to detect "is mine")
-- but keep email and rgpd_consent hidden from public.
REVOKE SELECT ON public.invites FROM anon, authenticated;
GRANT SELECT (id, event_id, prenom, avatar_url, device_id, created_at)
  ON public.invites TO anon, authenticated;

-- Admins can read everything (email, rgpd_consent included) via this policy
-- — column-level grants override the SELECT policy's column scope, so admins
-- need an explicit grant on the sensitive columns too.
GRANT SELECT (email, rgpd_consent) ON public.invites TO authenticated;

-- Existing public SELECT policy covers all rows; we add an admin-only column
-- access control via a separate policy is not possible in Postgres (column
-- privileges are role-level). The 'authenticated' role gets read access to
-- email/rgpd_consent via the GRANT above; we rely on the app to only query
-- these columns from admin contexts. Anonymous users cannot read them.
