-- Nettoyage des anciennes policies redondantes / dangereuses
DROP POLICY IF EXISTS "n8n_update_events" ON public.events;
DROP POLICY IF EXISTS "n8n_archive_events" ON public.events;
DROP POLICY IF EXISTS "n8n_update_status" ON public.events;
-- allow_update_events autorisait TOUT update par n'importe qui : faille majeure
DROP POLICY IF EXISTS "allow_update_events" ON public.events;

-- Policy unique et stricte pour n8n via anon key
-- Autorise uniquement les transitions active->expired et expired->archived
CREATE POLICY "anon_can_transition_event_status"
ON public.events
FOR UPDATE
TO anon
USING (status IN ('active'::event_status, 'expired'::event_status))
WITH CHECK (status IN ('expired'::event_status, 'archived'::event_status));
