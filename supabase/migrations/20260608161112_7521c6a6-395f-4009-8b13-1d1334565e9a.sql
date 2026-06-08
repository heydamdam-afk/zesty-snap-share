
-- Keep event_admins.email in sync when a user's auth email changes.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
    UPDATE public.event_admins
      SET email = NEW.email
      WHERE user_id = NEW.id
         OR lower(email) = lower(OLD.email);
  END IF;
  RETURN NEW;
END
$function$;

-- One-shot backfill: any event_admins row whose user_id points to an auth.users
-- whose current email differs gets resynchronised.
UPDATE public.event_admins ea
SET email = u.email
FROM auth.users u
WHERE ea.user_id = u.id
  AND lower(ea.email) IS DISTINCT FROM lower(u.email);
