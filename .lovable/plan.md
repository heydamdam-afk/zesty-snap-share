## Objectif

Créer un puits de log centralisé qui trace, étape par étape, toute la séquence "création d'événement → redirection → connexion → arrivée sur le dashboard", avec tous les messages d'erreur. Objectif : pouvoir diagnostiquer en quelques secondes pourquoi un user comme Lisa tombe sur "vous n'êtes pas admin" ou sur le mauvais écran.

## Ce qui sera mis en place

### 1. Table `event_flow_logs` (Supabase)

Une seule table append-only qui stocke tous les événements du tunnel.

Colonnes principales :
- `id`, `created_at`
- `flow_id` (uuid généré côté client au début du tunnel, conservé jusqu'à l'arrivée sur le dashboard — permet de reconstituer une session complète)
- `step` (texte court : `checkout_start`, `pending_inserted`, `stripe_session_created`, `free_event_created`, `paid_event_created_webhook`, `needs_set_password_check`, `redirect_to_login`, `login_attempt`, `login_success`, `login_failure`, `admin_check`, `admin_check_failure`, `dashboard_reached`, `set_password_attempt`, `set_password_success`, `set_password_failure`)
- `status` (`info` | `success` | `error`)
- `email` (lowercased, nullable)
- `event_id`, `slug`, `plan_code`, `stripe_session_id`, `pending_id` (tous nullables)
- `error_code`, `error_message` (textes courts, nullables)
- `context` (jsonb : payload arbitraire — needsSetPassword, has_password, last_sign_in_at, user_agent, redirect target, etc.)

RLS :
- `service_role` : ALL
- `authenticated` : SELECT uniquement si `is_platform_admin(auth.uid())`
- pas d'accès `anon`
- GRANT explicites (insert via service_role only — toutes les écritures passent par le backend)

### 2. Helper d'écriture côté serveur

`src/lib/flow-log.server.ts` exporte `logFlow({ flowId, step, status, ... })`. Implémentation : insert dans `event_flow_logs` via `supabaseAdmin`, jamais throw (catch + console.error pour ne pas casser le flow utilisateur si l'insert échoue).

### 3. Server function d'ingestion côté client

`src/lib/flow-log.functions.ts` expose `logFlowEvent` (createServerFn POST, pas de auth middleware — public, validé via Zod, rate-limit léger par flow_id côté handler) pour que le navigateur puisse pusher les événements qu'il est seul à voir (clic sur "créer mon event", redirection, tentative de login, échec admin, etc.).

### 4. Points d'instrumentation

Tous existent déjà — on ajoute un `logFlow(...)` aux endroits clés, sans changer la logique métier :

Backend (`src/lib/create-event.functions.ts`) :
- entrée de `createCheckoutSession` → `checkout_start`
- après insert pending → `pending_inserted`
- erreurs (`slug_taken`, `code_taken`, `coupon_*`, `pending_insert_failed`, `event_create_failed`, `stripe_price_not_found`) → `status: error` avec `error_code`
- création event gratuit → `free_event_created` (+ `needsSetPassword` dans context)
- création session Stripe → `stripe_session_created`
- `lookupEventBySessionId` quand `ready: true` → `paid_event_created_webhook`
- `prepareSetPassword` / `setInitialPassword` / `setPasswordForNewAccount` → succès et erreurs

Webhook Stripe (`src/routes/api/public/payments/webhook.ts`) :
- succès → `paid_event_created_webhook`
- erreurs de signature, de RPC `create_event_from_pending` → `status: error`

Frontend :
- `src/routes/create-event.checkout.tsx` : génération du `flow_id` au montage, push à chaque étape (envoi formulaire, retour serveur, redirection finale vers `/login?...`)
- `src/routes/create-event.success.tsx` : push à chaque poll, à la redirection finale
- `src/routes/index.tsx` (page login) : push `login_attempt` / `login_success` / `login_failure` (avec le message d'erreur Supabase exact), push `admin_check_failure` quand la popup "vous n'êtes pas admin" apparaît
- `src/routes/$slug.admin.dashboard.tsx` : push `dashboard_reached` au montage

Le `flow_id` voyage via `sessionStorage` (clé `kapsul_flow_id`), conservé jusqu'à l'arrivée sur le dashboard puis nettoyé.

### 5. Page d'inspection (platform admin uniquement)

Nouvelle route `src/routes/platform.flow-logs.tsx` réservée aux platform admins :
- liste paginée des derniers `flow_id`, regroupés (timestamp début, email, slug, plan, statut final, dernière erreur)
- détail d'un flow : timeline verticale de tous les `step` avec status (vert/rouge), tous les `context` dépliables, error_code / error_message en évidence
- filtres : email, slug, date, statut (avec erreur uniquement)

### 6. Vérifications

- politique RLS : un user lambda ne peut rien lire
- un flow complet de création gratuite produit la timeline attendue
- un échec volontaire (slug déjà pris, mauvais mot de passe) apparaît bien en rouge dans la page d'inspection
- aucune PII sensible loggée au-delà de l'email (pas de mot de passe, pas de token)

## Hors scope

- Pas de modification de la logique de redirection ou de l'auth (uniquement de l'observation).
- Pas d'alerting / webhook externe — la page d'inspection suffit pour ce premier jet.
- Pas de purge automatique — à voir plus tard si volume.

## Question pour validation

Tu confirmes que tu veux la page d'inspection intégrée dans l'app (route `/platform/flow-logs` accessible aux platform admins) ? Sinon je peux me limiter à la table + l'instrumentation, et tu interroges via le tooling Cloud.
