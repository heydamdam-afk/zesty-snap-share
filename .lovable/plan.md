## Contexte schéma (vérifié)

- `events` n'a **pas** de FK vers `profiles`. Le propriétaire d'un event est l'**organisateur** stocké dans `event_admins` (`role = 'organisateur'`), avec `email` (text) et `user_id` (uuid, peut être NULL).
- `events.contact` contient bien un email texte, mais ce n'est pas la source de vérité fiable. La bonne jointure est :
  ```
  events.id  ──►  event_admins.event_id  (role='organisateur')
  event_admins.email  ──►  profiles.email  (lower-case match)
  ```
- `profiles` expose `email`, `prenom`, `avatar_name`. `event_admins` expose aussi `prenom`.

## Plan — partie Supabase uniquement

### 1. Nouvelle RPC `get_expiring_events_in_days(_days int)`

`SECURITY DEFINER`, lecture seule, retour strictement minimal :

- `event_id uuid`
- `titre text`
- `slug text`
- `expire_at timestamptz`
- `owner_email text` (l'email de l'organisateur)
- `owner_prenom text` (depuis `profiles.prenom` si dispo, sinon `event_admins.prenom`)

Pas de `contact`, pas de `stripe_session_id`, pas de `paid_amount_cents`, pas de `cover_url`, pas de `lieu`.

Filtres :
- `status = 'active'`
- `expire_at::date = (now() + _days * interval '1 day')::date` — fenêtre journalière exacte pour éviter doubles envois.

Paramètre `_days` (au lieu de hardcoder 30) pour que la même RPC serve J+30, J+7, J+1, etc. — un seul objet à maintenir.

Permissions : `GRANT EXECUTE ... TO service_role` uniquement. **Pas** `anon`/`authenticated` — n8n appellera avec la clé `service_role`.

### 2. Documentation des 3 workflows n8n

Je te livre, pour chacun, **uniquement** ce que le node Supabase doit lire :

**Workflow J+30 (rappel d'expiration)**
- Appel : RPC `get_expiring_events_in_days` avec `{ "_days": 30 }`
- Retour : voir ci-dessus.

**Workflow J+37 (freeze / archivage automatique)**
- Lecture directe table `events`
- Colonnes minimales : `id, titre, slug, status, expire_at`
- Filtre : `status = 'expired' AND expire_at < now() - interval '7 days'`
- Pour récupérer les destinataires email : lire `event_admins` (`email`) filtré sur `event_id`. Ne pas lire `events.contact`.
- L'écriture du statut doit passer par l'endpoint existant `/api/public/expire-events` (déjà sécurisé par `N8N_CRON_SECRET`), **pas** par un UPDATE direct.

**Workflow sync marketing**
- Lecture table `marketing_contacts`
- Colonnes : `id, email, prenom, role, event_id, nom_event, date_event, statut_event, rgpd_consent, brevo_synced, updated_at`
- Filtre typique : `rgpd_consent = true AND brevo_synced = false`
- Écriture : `UPDATE marketing_contacts SET brevo_synced = true WHERE id = ...`

### 3. Livrables pour toi

Une fois la migration appliquée, je te fournis dans la réponse finale :
- Le SQL exact de la RPC créée
- Un exemple d'appel n8n complet (URL `https://<project>.supabase.co/rest/v1/rpc/get_expiring_events_in_days`, headers `apikey` + `Authorization: Bearer <service_role>`, body `{"_days":30}`)
- Un récap des trois nodes Supabase à configurer

## Hors périmètre (confirmé)
- Pas de reconfiguration n8n
- Pas de changement de RLS sur `events` / `event_admins` / `marketing_contacts`
- Pas de modification de la table `events` ni de ses colonnes
