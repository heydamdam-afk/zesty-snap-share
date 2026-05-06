ALTER TABLE public.event_admins
  DROP CONSTRAINT IF EXISTS event_admins_added_by_fkey;

ALTER TABLE public.event_admins
  ADD CONSTRAINT event_admins_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.event_coupons
  SET uses_count = 0, max_uses = 5, active = true
  WHERE code = 'DBRETEAU-FREE';