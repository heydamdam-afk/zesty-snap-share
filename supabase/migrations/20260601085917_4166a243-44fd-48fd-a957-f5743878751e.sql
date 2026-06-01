
CREATE SEQUENCE IF NOT EXISTS public.bug_tickets_number_seq START 1000;

CREATE TABLE public.bug_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number integer NOT NULL DEFAULT nextval('public.bug_tickets_number_seq'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL,
  severity text NOT NULL,
  as_who text,
  was_doing text,
  wanted_to text,
  expected_behavior text,
  contact_email text NOT NULL,
  contact_phone text,
  page_url text,
  browser text,
  os text,
  user_agent text,
  screenshots_count integer NOT NULL DEFAULT 0,
  email_sent boolean NOT NULL DEFAULT false,
  email_error text
);

ALTER SEQUENCE public.bug_tickets_number_seq OWNED BY public.bug_tickets.ticket_number;

CREATE UNIQUE INDEX bug_tickets_ticket_number_key ON public.bug_tickets(ticket_number);

GRANT SELECT, INSERT ON public.bug_tickets TO anon;
GRANT SELECT, INSERT ON public.bug_tickets TO authenticated;
GRANT ALL ON public.bug_tickets TO service_role;
GRANT USAGE ON SEQUENCE public.bug_tickets_number_seq TO anon, authenticated, service_role;

ALTER TABLE public.bug_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY anyone_can_submit_bug_tickets
  ON public.bug_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(title) BETWEEN 1 AND 200
    AND severity IN ('critique','elevee','moyenne','faible')
    AND char_length(contact_email) BETWEEN 3 AND 255
  );

CREATE POLICY platform_admins_read_bug_tickets
  ON public.bug_tickets
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
