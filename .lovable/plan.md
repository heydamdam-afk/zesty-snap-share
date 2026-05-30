# Logging flow création event — version minimale

Périmètre réduit : pas de page d'inspection in-app. Tu interrogeras `event_flow_logs` via le tooling Cloud (read_query).

## 1. Table `event_flow_logs` (migration)

Colonnes :
- `id` uuid PK
- `created_at` timestamptz default now()
- `flow_id` text (généré côté client, persiste jusqu'au dashboard)
- `step` text (ex: `checkout_start`, `stripe_session_created`, `webhook_received`, `pending_consumed`, `event_created`, `free_redirect`, `login_attempt`, `set_password`, `dashboard_reached`, …)
- `status` text check in (`info`, `success`, `error`)
- `email` text null
- `event_id` uuid null
- `slug` text null
- `plan_code` text null
- `stripe_session_id` text null
- `pending_id` uuid null
- `error_code` text null
- `error_message` text null
- `context` jsonb null

Index : `(flow_id, created_at)`, `(created_at desc)`, `(email)`, `(event_id)`.

RLS :
- `service_role` ALL
- `authenticated` SELECT uniquement si `is_platform_admin(auth.uid())`
- pas d'`anon`

GRANTs : `service_role` ALL, `authenticated` SELECT.

## 2. Helpers

**`src/lib/flow-log.server.ts`** — `logFlow(payload)` qui insert via `supabaseAdmin`, never throws (try/catch silencieux + `console.warn`).

**`src/lib/flow-log.functions.ts`** — `logFlowEvent` serverFn publique, `inputValidator` Zod (step/status enum, longueurs bornées), appelle `logFlow`. Rate-limit simple en mémoire par `flow_id` (max ~50 events/flow).

## 3. Génération et propagation du `flow_id`

- Généré côté client (`crypto.randomUUID()`) au premier point d'entrée du flow (clic offre sur `/` ou arrivée sur `create-event.checkout`).
- Stocké dans `sessionStorage` sous `kapsul_flow_id`.
- Passé en métadonnée Stripe (`metadata.flow_id`) pour relier webhook ↔ client.
- Récupéré par le webhook depuis `session.metadata.flow_id` et propagé dans `pending_events.payload.flow_id` puis dans les logs serveur.
- Nettoyé du `sessionStorage` à l'arrivée sur le dashboard.

## 4. Points d'instrumentation

Frontend (via `logFlowEvent` serverFn) :
- `src/routes/index.tsx` : `landing_view`, `offer_selected`, `checkout_redirect`
- `src/routes/create-event.checkout.tsx` : `checkout_form_view`, `checkout_submit`, `stripe_redirect`, `free_event_create_start`, `free_event_create_success`, `free_event_create_error`, `free_redirect`
- `src/routes/create-event.success.tsx` : `success_page_view`, `success_poll_*`, `dashboard_redirect`
- `src/routes/login.tsx` (ou équivalent) : `login_view`, `login_submit`, `login_error` (avec `error_code` = `not_admin`, `invalid_password`, …), `set_password_view`, `set_password_success`
- `src/routes/$slug.admin.dashboard.tsx` : `dashboard_reached` + cleanup `sessionStorage`

Serveur (via `logFlow` direct) :
- `src/lib/create-event.functions.ts` : `pending_created`, `event_created`, chaque branche d'erreur avec `error_code`
- Webhook Stripe (`src/routes/api/...`) : `webhook_received`, `webhook_signature_ok`, `pending_consumed`, `event_created_from_webhook`, erreurs

Chaque appel inclut `flow_id`, `email`, `plan_code`, et le contexte pertinent (ex: `stripe_session_id`).

## 5. Hors périmètre (confirmé)

- Pas de page `/platform/flow-logs`.
- Pas de purge automatique (à ajouter plus tard si besoin).
- Pas d'alerting.
- Pas de modification de la logique d'auth/redirection existante.

## Détails techniques

- `logFlow` ne bloque jamais le flow utilisateur : tout est en `try/catch` avec `console.warn` seulement.
- `logFlowEvent` (serverFn publique) protège contre les abus avec rate-limit par `flow_id` + validation Zod stricte.
- Les colonnes nullables permettent d'instrumenter chaque étape sans dépendance.
- Requêtes type Cloud pour debug :
  ```sql
  select * from event_flow_logs where email = 'x@y.z' order by created_at;
  select * from event_flow_logs where flow_id = '...' order by created_at;
  select * from event_flow_logs where status = 'error' and created_at > now() - interval '24h';
  ```
