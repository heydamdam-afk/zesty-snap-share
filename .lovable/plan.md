## Principe

n8n ne tape plus jamais Supabase directement. Il appelle uniquement des endpoints `/api/public/*` de ton app, tous sécurisés par `Authorization: Bearer <N8N_CRON_SECRET>` (secret inchangé, déjà présent côté n8n et côté Lovable). L'app fait les requêtes Supabase côté serveur avec `service_role` — clé jamais exposée.

## Existant réutilisé (pas de changement)

- `POST /api/public/expire-events` — change le statut d'un event (`active→expired` puis `expired→archived`), renvoie `admins_emails`.
- `POST /api/public/freeze-complete` — callback après génération du ZIP, écrit `zip_download_url`, passe l'event en `frozen`, renvoie `admins_emails`.

## Nouveaux endpoints à créer

### A. `GET /api/public/n8n/expiring-events?days=30`
Workflow J+30 (rappel d'expiration).
- Header : `Authorization: Bearer <N8N_CRON_SECRET>`
- Query : `days` (entier, défaut 30)
- Implémentation : appel de la RPC existante `get_expiring_events_in_days(_days)` via `supabaseAdmin`
- Retour : `{ events: [{ event_id, titre, slug, expire_at, owner_email, owner_prenom }] }`

### B. `GET /api/public/n8n/events-to-freeze`
Workflow J+37 (freeze automatique).
- Header : `Authorization: Bearer <N8N_CRON_SECRET>`
- Implémentation : SELECT events où `status = 'expired' AND expire_at < now() - interval '7 days'`, puis jointure `event_admins` pour les emails de tous les admins
- Retour : `{ events: [{ event_id, titre, slug, expire_at, admins_emails: [] }] }`
- n8n enchaîne ensuite : pour chaque event → génère le ZIP → appelle `POST /api/public/freeze-complete` (existant).

### C. `GET /api/public/n8n/marketing-to-sync?limit=100`
Workflow sync marketing — lecture.
- Header : `Authorization: Bearer <N8N_CRON_SECRET>`
- Query : `limit` (entier, défaut 100, max 500)
- Implémentation : SELECT `marketing_contacts` où `rgpd_consent = true AND brevo_synced = false`
- Retour : `{ contacts: [{ id, email, prenom, role, event_id, nom_event, date_event, statut_event }] }`

### D. `POST /api/public/n8n/marketing-mark-synced`
Workflow sync marketing — écriture après envoi Brevo.
- Header : `Authorization: Bearer <N8N_CRON_SECRET>`
- Body : `{ ids: string[] }` (UUIDs des contacts synchronisés)
- Implémentation : `UPDATE marketing_contacts SET brevo_synced = true WHERE id = ANY($1)`
- Retour : `{ updated_count: number }`

## Sécurité

- Auth `Authorization: Bearer` (cohérent avec les 2 endpoints existants).
- Validation Zod sur tous les inputs (query + body).
- Retour JSON normalisé (`{ ok, ... }` ou `{ error, ... }`).
- Aucune PII exposée au-delà du strict nécessaire (pas de `contact`, pas de `stripe_session_id`, etc.).

## Récap configuration n8n (à coller dans tes nodes HTTP Request)

**Base URL** : `https://app.kapsul.events` (custom domain — stable).

**Header commun à tous les nodes** :
```
Authorization: Bearer {{ $env.N8N_CRON_SECRET }}
```

| Workflow | Étape | Méthode | URL | Body |
|---|---|---|---|---|
| **J+30 rappel** | 1. Lister | GET | `/api/public/n8n/expiring-events?days=30` | — |
| **J+37 freeze** | 1. Lister | GET | `/api/public/n8n/events-to-freeze` | — |
| **J+37 freeze** | 2. Pour chaque event : marquer frozen + ZIP | POST | `/api/public/freeze-complete` | `{ "event_id": "...", "zip_download_url": "https://..." }` |
| **Sync marketing** | 1. Lister | GET | `/api/public/n8n/marketing-to-sync?limit=100` | — |
| **Sync marketing** | 2. Marquer synchronisés (après Brevo) | POST | `/api/public/n8n/marketing-mark-synced` | `{ "ids": ["uuid1", "uuid2"] }` |
| **Transitions statut (optionnel)** | Passer un event à expired/archived | POST | `/api/public/expire-events` | `{ "id": "uuid", "status": "expired" }` |

## Hors périmètre

- Pas de reconfiguration n8n (tu le fais).
- Pas de nouvelle RPC Supabase (on réutilise `get_expiring_events_in_days`).
- Pas de rotation du secret.
- Pas de changement RLS.