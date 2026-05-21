
-- 1) Helper to upsert a marketing contact for an event participant
CREATE OR REPLACE FUNCTION public.upsert_marketing_contact(
  _event_id uuid,
  _email text,
  _prenom text,
  _role text,
  _rgpd_consent boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ev public.events;
  _existing_id uuid;
  _email_clean text;
BEGIN
  IF _role NOT IN ('invite', 'admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  -- Invité : pas d'enregistrement sans consentement RGPD
  IF _role = 'invite' AND COALESCE(_rgpd_consent, false) = false THEN
    RETURN;
  END IF;

  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN;
  END IF;
  _email_clean := lower(trim(_email));

  SELECT * INTO _ev FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT id INTO _existing_id
  FROM public.marketing_contacts
  WHERE event_id = _event_id
    AND lower(email) = _email_clean
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    IF _role = 'admin' THEN
      UPDATE public.marketing_contacts
        SET role = 'admin', updated_at = now()
        WHERE id = _existing_id;
    ELSE
      UPDATE public.marketing_contacts
        SET updated_at = now()
        WHERE id = _existing_id;
    END IF;
  ELSE
    INSERT INTO public.marketing_contacts (
      prenom, email, role, event_id, nom_event,
      date_event, statut_event, rgpd_consent
    ) VALUES (
      COALESCE(NULLIF(trim(_prenom), ''), 'Invité'),
      _email_clean,
      _role,
      _event_id,
      _ev.titre,
      _ev.event_date,
      'active',
      COALESCE(_rgpd_consent, _role = 'admin')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_marketing_contact(uuid, text, text, text, boolean) TO anon, authenticated;

-- 2) Trigger : sync statut_event quand un event passe en expired/archived
CREATE OR REPLACE FUNCTION public.sync_marketing_contacts_on_event_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('expired', 'archived') THEN
    UPDATE public.marketing_contacts
       SET statut_event = NEW.status::text,
           email = NULL,
           updated_at = now()
     WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_sync_marketing_contacts_event_status ON public.events;
CREATE TRIGGER aa_sync_marketing_contacts_event_status
BEFORE UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_marketing_contacts_on_event_status();
