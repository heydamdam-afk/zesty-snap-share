-- 1. Enable RLS on app_screens with public SELECT
ALTER TABLE public.app_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read_app_screens"
  ON public.app_screens FOR SELECT
  TO public USING (true);

-- 2. Add service_role policies on pending_events (RLS already enabled, no policy)
CREATE POLICY "service_role_manage_pending_events"
  ON public.pending_events FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Restrict marketing_contacts INSERT — drop anon insert
DROP POLICY IF EXISTS marketing_insert_all ON public.marketing_contacts;
CREATE POLICY "marketing_insert_authenticated_or_service"
  ON public.marketing_contacts FOR INSERT
  TO public
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

-- 4. Revoke stripe_session_id from anon (server uses service role / admin client)
REVOKE SELECT (stripe_session_id) ON public.events FROM anon;

-- 5. Fix function search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;