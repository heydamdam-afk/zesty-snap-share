CREATE TABLE public.event_flow_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  flow_id text NOT NULL,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('info','success','error')),
  email text,
  event_id uuid,
  slug text,
  plan_code text,
  stripe_session_id text,
  pending_id uuid,
  error_code text,
  error_message text,
  context jsonb
);

GRANT SELECT ON public.event_flow_logs TO authenticated;
GRANT ALL ON public.event_flow_logs TO service_role;

ALTER TABLE public.event_flow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_read_flow_logs"
  ON public.event_flow_logs
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "service_role_manage_flow_logs"
  ON public.event_flow_logs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_event_flow_logs_flow_id ON public.event_flow_logs (flow_id, created_at);
CREATE INDEX idx_event_flow_logs_created_at ON public.event_flow_logs (created_at DESC);
CREATE INDEX idx_event_flow_logs_email ON public.event_flow_logs (email);
CREATE INDEX idx_event_flow_logs_event_id ON public.event_flow_logs (event_id);
