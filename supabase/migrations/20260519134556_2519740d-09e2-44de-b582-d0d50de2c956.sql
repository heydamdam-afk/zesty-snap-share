CREATE OR REPLACE FUNCTION public.cascade_delete_archived_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_ids uuid[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'archived' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'archived' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO post_ids
    FROM public.posts
   WHERE event_id = NEW.id;

  IF array_length(post_ids, 1) IS NOT NULL THEN
    DELETE FROM public.likes        WHERE photo_id = ANY(post_ids);
    DELETE FROM public.commentaires WHERE photo_id = ANY(post_ids);
    DELETE FROM public.post_photos  WHERE post_id  = ANY(post_ids);
    DELETE FROM public.posts        WHERE id       = ANY(post_ids);
  END IF;

  DELETE FROM public.event_bans      WHERE event_id = NEW.id;
  DELETE FROM public.banned_invites  WHERE event_id = NEW.id;
  DELETE FROM public.invites         WHERE event_id = NEW.id;
  -- event_admins NOT deleted: admins are registered users of the app
  DELETE FROM public.event_admins    WHERE event_id = NEW.id;

  DELETE FROM public.events WHERE id = NEW.id;

  RETURN NULL;
END;
$function$;