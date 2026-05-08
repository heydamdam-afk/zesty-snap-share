ALTER TABLE public.post_photos
  ADD COLUMN event_titre text;

UPDATE public.post_photos ph
SET event_titre = e.titre
FROM public.posts p
JOIN public.events e ON e.id = p.event_id
WHERE ph.post_id = p.id;