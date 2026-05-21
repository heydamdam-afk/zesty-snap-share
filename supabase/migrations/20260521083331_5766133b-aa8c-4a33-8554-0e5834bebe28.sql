CREATE OR REPLACE FUNCTION public.upsert_marketing_contact(_event_id uuid, _email text, _prenom text, _role text, _rgpd_consent boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Clé unique = email seul (toutes events confondus)
  SELECT id INTO _existing_id
  FROM public.marketing_contacts
  WHERE lower(email) = _email_clean
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.marketing_contacts
       SET prenom       = COALESCE(NULLIF(trim(_prenom), ''), prenom),
           email        = _email_clean,
           role         = _role,
           event_id     = _event_id,
           nom_event    = _ev.titre,
           date_event   = _ev.event_date,
           statut_event = 'active',
           rgpd_consent = COALESCE(_rgpd_consent, _role = 'admin'),
           updated_at   = now()
     WHERE id = _existing_id;
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
$function$;