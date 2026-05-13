ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS zip_download_url text;

ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'frozen';