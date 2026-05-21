DROP TRIGGER IF EXISTS aa_sync_marketing_contacts_event_status ON public.events;
DROP FUNCTION IF EXISTS public.sync_marketing_contacts_on_event_status() CASCADE;
DROP FUNCTION IF EXISTS public.upsert_marketing_contact(uuid, text, text, text, boolean);