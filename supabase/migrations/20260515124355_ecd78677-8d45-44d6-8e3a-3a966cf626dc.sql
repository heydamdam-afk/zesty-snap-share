CREATE POLICY "admins_can_update_events"
ON public.events
FOR UPDATE
TO authenticated
USING (public.is_event_admin_email(id))
WITH CHECK (public.is_event_admin_email(id));