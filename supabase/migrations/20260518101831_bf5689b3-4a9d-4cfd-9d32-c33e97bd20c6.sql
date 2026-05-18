CREATE OR REPLACE FUNCTION public.cascade_delete_archived_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  DELETE FROM public.event_admins    WHERE event_id = NEW.id;

  DELETE FROM public.events WHERE id = NEW.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_archived_event ON public.events;
CREATE TRIGGER trg_cascade_delete_archived_event
AFTER UPDATE OF status ON public.events
FOR EACH ROW
WHEN (NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived')
EXECUTE FUNCTION public.cascade_delete_archived_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events';
  END IF;
END $$;