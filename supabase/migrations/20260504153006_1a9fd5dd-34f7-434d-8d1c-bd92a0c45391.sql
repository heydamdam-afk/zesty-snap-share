-- ============================================================
-- 1. Enum admin_role
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('organisateur', 'secondaire');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. Enrichir event_admins
-- ============================================================
ALTER TABLE public.event_admins
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES public.event_admins(id) ON DELETE SET NULL;

-- Backfill email depuis auth.users
UPDATE public.event_admins ea
SET email = u.email
FROM auth.users u
WHERE ea.user_id = u.id
  AND ea.email IS NULL;

-- Backfill prenom (à partir du raw_user_meta_data ou email avant @)
UPDATE public.event_admins ea
SET prenom = COALESCE(
  NULLIF(u.raw_user_meta_data->>'prenom', ''),
  NULLIF(u.raw_user_meta_data->>'first_name', ''),
  split_part(u.email, '@', 1)
)
FROM auth.users u
WHERE ea.user_id = u.id
  AND ea.prenom IS NULL;

-- Migrer le role text -> admin_role : 1er admin (par created_at) = organisateur, autres = secondaire
ALTER TABLE public.event_admins ADD COLUMN IF NOT EXISTS role_new public.admin_role;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.event_admins
)
UPDATE public.event_admins ea
SET role_new = CASE WHEN r.rn = 1 THEN 'organisateur'::public.admin_role ELSE 'secondaire'::public.admin_role END
FROM ranked r
WHERE ea.id = r.id;

ALTER TABLE public.event_admins DROP COLUMN role;
ALTER TABLE public.event_admins RENAME COLUMN role_new TO role;
ALTER TABLE public.event_admins ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.event_admins ALTER COLUMN role SET DEFAULT 'secondaire'::public.admin_role;

-- email obligatoire désormais (mais user_id devient nullable pour invitation par email avant inscription)
ALTER TABLE public.event_admins ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.event_admins ALTER COLUMN user_id DROP NOT NULL;

-- Unicité email par event
CREATE UNIQUE INDEX IF NOT EXISTS event_admins_event_email_uniq
  ON public.event_admins (event_id, lower(email));

-- Un seul organisateur par event
CREATE UNIQUE INDEX IF NOT EXISTS event_admins_one_organisateur
  ON public.event_admins (event_id)
  WHERE role = 'organisateur';

-- ============================================================
-- 3. Helpers SECURITY DEFINER (évitent récursion RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_admin_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_event_admin_email(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE event_id = _event_id
      AND lower(email) = public.current_admin_email()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_organisateur_email(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE event_id = _event_id
      AND role = 'organisateur'
      AND lower(email) = public.current_admin_email()
  );
$$;

-- Mise à jour de l'ancien helper is_event_admin pour qu'il accepte aussi un match par email
-- (compat avec le code existant qui utilise auth.uid() côté RLS)
CREATE OR REPLACE FUNCTION public.is_event_admin(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_admins ea
    WHERE ea.event_id = _event_id
      AND (
        ea.user_id = _user_id
        OR lower(ea.email) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
      )
  );
$$;

-- ============================================================
-- 4. RLS event_admins (refonte)
-- ============================================================
DROP POLICY IF EXISTS users_can_read_own_admin_rows ON public.event_admins;

CREATE POLICY admins_can_read_event_admins
  ON public.event_admins FOR SELECT
  TO authenticated
  USING (public.is_event_admin_email(event_id));

CREATE POLICY organisateur_can_insert_secondaire
  ON public.event_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'secondaire'
    AND public.is_event_organisateur_email(event_id)
  );

CREATE POLICY organisateur_can_delete_secondaire
  ON public.event_admins FOR DELETE
  TO authenticated
  USING (
    role = 'secondaire'
    AND public.is_event_organisateur_email(event_id)
  );

-- UPDATE : un admin peut compléter ses infos (prenom, user_id) lors de son 1er login
CREATE POLICY admin_can_self_update
  ON public.event_admins FOR UPDATE
  TO authenticated
  USING (lower(email) = public.current_admin_email())
  WITH CHECK (lower(email) = public.current_admin_email());

-- ============================================================
-- 5. Enrichir events (quota + uploads_actifs)
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS uploads_actifs boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quota_mo integer NOT NULL DEFAULT 6144,
  ADD COLUMN IF NOT EXISTS used_mo integer NOT NULL DEFAULT 0;

-- UPDATE events : seul un admin peut modifier l'event
DROP POLICY IF EXISTS admins_can_update_events ON public.events;
CREATE POLICY admins_can_update_events
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.is_event_admin_email(id))
  WITH CHECK (public.is_event_admin_email(id));

-- ============================================================
-- 6. Table event_bans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL,
  device_id text NOT NULL,
  prenom text,
  banni_par uuid REFERENCES public.event_admins(id) ON DELETE SET NULL,
  banni_par_prenom text,
  banni_at timestamptz NOT NULL DEFAULT now(),
  raison text,
  UNIQUE (event_id, device_id)
);

ALTER TABLE public.event_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY anyone_can_read_event_bans
  ON public.event_bans FOR SELECT
  TO public
  USING (true);

CREATE POLICY admins_can_insert_event_bans
  ON public.event_bans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_admin_email(event_id));

CREATE POLICY admins_can_delete_event_bans
  ON public.event_bans FOR DELETE
  TO authenticated
  USING (public.is_event_admin_email(event_id));

-- ============================================================
-- 7. RPC transfer_organisateur
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_organisateur(
  p_event_id uuid,
  p_current_org_id uuid,
  p_new_org_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller_email text := public.current_admin_email();
  _current_email text;
BEGIN
  -- Vérifier que l'appelant est bien l'organisateur actuel
  SELECT lower(email) INTO _current_email
  FROM public.event_admins
  WHERE id = p_current_org_id
    AND event_id = p_event_id
    AND role = 'organisateur';

  IF _current_email IS NULL OR _current_email <> _caller_email THEN
    RAISE EXCEPTION 'not_current_organisateur';
  END IF;

  -- Vérifier que la cible est bien un secondaire de cet event
  IF NOT EXISTS (
    SELECT 1 FROM public.event_admins
    WHERE id = p_new_org_id
      AND event_id = p_event_id
      AND role = 'secondaire'
  ) THEN
    RAISE EXCEPTION 'target_not_secondaire';
  END IF;

  -- Transaction atomique : on bascule l'organisateur en secondaire d'abord,
  -- puis le secondaire en organisateur (sinon contrainte d'unicité violée)
  UPDATE public.event_admins SET role = 'secondaire'
    WHERE id = p_current_org_id;
  UPDATE public.event_admins SET role = 'organisateur'
    WHERE id = p_new_org_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 8. RPC pour qu'un admin "matérialise" son user_id au 1er login
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_admin_user_id()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.event_admins
  SET user_id = auth.uid()
  WHERE lower(email) = (SELECT lower(email) FROM auth.users WHERE id = auth.uid())
    AND user_id IS NULL;
END;
$$;