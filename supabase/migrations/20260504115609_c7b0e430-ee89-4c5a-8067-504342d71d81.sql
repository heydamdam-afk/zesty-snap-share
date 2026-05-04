-- Ensure prenom is unique per event (case-insensitive)
-- First, deduplicate any existing collisions by suffixing duplicates
WITH ranked AS (
  SELECT id, event_id, prenom,
    ROW_NUMBER() OVER (PARTITION BY event_id, lower(prenom) ORDER BY created_at) AS rn
  FROM public.invites
)
UPDATE public.invites i
SET prenom = i.prenom || ' ' || r.rn
FROM ranked r
WHERE i.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS unique_prenom_per_event_ci
  ON public.invites (event_id, lower(prenom));