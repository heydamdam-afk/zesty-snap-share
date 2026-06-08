-- Restrict public exposure of sensitive columns via column-level grants.
-- Anon/authenticated retain SELECT on safe columns only.

-- events: hide contact, stripe_session_id, paid_amount_cents
REVOKE SELECT ON public.events FROM anon, authenticated;
GRANT SELECT (
  id, titre, slug, code_acces, status, expire_at,
  commentaires_actifs, likes_actifs, telechargement_actif,
  created_at, cover_url, event_date, lieu, uploads_actifs,
  quota_mo, used_mo, frozen_at, zip_download_url, plan_code
) ON public.events TO anon, authenticated;

-- event_plans: hide stripe_price_id (client uses hardcoded values)
REVOKE SELECT ON public.event_plans FROM anon, authenticated;
GRANT SELECT (
  code, nom, prix_cents, quota_mo, max_photos, max_invites,
  duree_jours, is_top, sort_order, description_courte,
  description_usage, active, created_at
) ON public.event_plans TO anon, authenticated;
