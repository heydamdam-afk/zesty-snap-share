ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS event_date timestamptz,
  ADD COLUMN IF NOT EXISTS lieu text,
  ADD COLUMN IF NOT EXISTS contact text;