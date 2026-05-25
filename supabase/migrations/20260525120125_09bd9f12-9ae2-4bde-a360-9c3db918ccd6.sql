
-- 1. Remove public/auth column access to Stripe identifiers + paid amount on events.
--    Server-side code uses supabaseAdmin (service_role) which is unaffected.
REVOKE SELECT (stripe_session_id, paid_amount_cents) ON public.events FROM anon, authenticated;

-- 2. Tighten marketing_contacts: only admins of the related event may read/update,
--    and only for rows actually scoped to one of their events.
DROP POLICY IF EXISTS marketing_select_authenticated ON public.marketing_contacts;
DROP POLICY IF EXISTS marketing_update_authenticated ON public.marketing_contacts;

CREATE POLICY marketing_select_event_admin
  ON public.marketing_contacts
  FOR SELECT
  TO authenticated
  USING (event_id IS NOT NULL AND public.is_event_admin_email(event_id));

CREATE POLICY marketing_update_event_admin
  ON public.marketing_contacts
  FOR UPDATE
  TO authenticated
  USING (event_id IS NOT NULL AND public.is_event_admin_email(event_id))
  WITH CHECK (event_id IS NOT NULL AND public.is_event_admin_email(event_id));
