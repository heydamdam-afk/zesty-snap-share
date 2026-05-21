# Refonte de la création d'événement Kapsul

## Vue d'ensemble

Remplacer la page actuelle `/create-event` par un flow en 2 étapes (sélection plan + form, puis paiement) avec création de l'event APRÈS paiement confirmé, suivi d'un magic link pour accéder au dashboard admin.

## Étape 1 — Plans tarifaires

5 plans (tous **1 mois**, sauf Découverte = **7 jours**) :

| Plan | Prix | Photos | Invités | Durée |
|---|---|---|---|---|
| Découverte | 0 € | 100 | 10 | 7 j |
| Essentiel | 29 € | 500 | 20 | 1 mois |
| Standard ⭐TOP | 79 € | 2 000 | 100 | 1 mois |
| Premium | 149 € | 5 000 | 200 | 1 mois |
| Illimitée | 199 € | ∞ | ∞ | 1 mois |

Les plans seront stockés en constante côté front + créés comme produits Stripe une fois Stripe activé.

## Étape 2 — Évolution du schéma DB

**Table `event_plans`** (nouvelle, lecture publique) :
- `code` (text PK), `nom`, `prix_cents`, `quota_mo`, `max_invites` (int null = ∞), `duree_jours`, `stripe_price_id`

**Table `event_coupons`** (extension) :
- ajouter `discount_percent` (int 0-100, nullable)
- ajouter `discount_amount_cents` (int, nullable)
- garder `type = 'free_event'` pour les coupons 100% gratuits
- RPC `validate_coupon` étendu : retourne aussi `discount_percent` / `discount_amount_cents`

**Table `events`** : ajouter `plan_code` (text), `paid_amount_cents`, `stripe_session_id` (pour idempotence)

**Table `pending_events`** (nouvelle) : stocke le payload du form pendant le checkout Stripe, indexée par `stripe_session_id`. Consommée par le webhook.

## Étape 3 — Page 1 `/create-event` (UI mockup #1)

Sections empilées :
1. **Sélecteur de plans** (5 cards horizontales, scroll mobile, badge TOP sur Standard)
2. **Bandeau dynamique** : "💡 Idéal pour [usage suggéré du plan]"
3. **Formulaire** :
   - Nom de l'événement (verrou "Définitif après création")
   - Date (input date, **min = aujourd'hui**)
   - **Lieu** (gardé depuis l'existant)
   - Code d'accès invités (auto-généré, modifiable)
   - Photo de couverture (optionnel, comme aujourd'hui)
   - Votre email (pré-rempli si user connecté)
4. **CTA** : "Continuer vers le paiement →" — texte change en "Créer mon événement →" si plan gratuit

## Étape 4 — Page 2 `/create-event/checkout` (UI mockup #2)

Affichée **uniquement si plan payant**. Si plan = Découverte (0 €), on saute directement à la création + magic link.

- Récap du plan (titre event, date, photos, durée)
- **Input coupon** avec validation live → recalcule le total
- Bouton "Payer XX € →" qui ouvre Stripe Checkout (redirect)
- Mentions sécurité

Si coupon = 100% gratuit → bouton devient "Créer mon événement →" (skip Stripe).

## Étape 5 — Stripe Payments (Lovable-managed)

1. Activation via `enable_stripe_payments`
2. Création des 4 produits payants via `batch_create_product`
3. Tax handling : à confirmer (recommandation : "no automation" pour démarrer simple, peut évoluer)
4. Server route `/api/public/stripe-webhook` → sur `checkout.session.completed` :
   - Lit `pending_events.payload` via `session.id`
   - Appelle nouvelle RPC `create_event_from_pending(session_id, paid_amount)`
   - Génère un **magic link** Supabase pour l'email du formulaire (signup OU signin selon que l'email existe)
   - Stocke le magic link → redirige l'utilisateur (page success) qui clique pour s'authentifier

## Étape 6 — Server functions

- `createCheckoutSession(planCode, formData, couponCode?)` → crée `pending_events`, retourne URL Stripe (ou crée direct l'event si total = 0)
- Webhook handler (server route)
- `sendMagicLinkAfterPayment(email, eventSlug)` — utilise `supabaseAdmin.auth.admin.generateLink` puis envoie via le système email Lovable

## Étape 7 — Flow post-paiement

```
Stripe success → /create-event/success?session_id=...
  → poll côté front jusqu'à event créé (webhook async)
  → "Compte créé ! Vérifiez votre email pour vous connecter"
  → user clique magic link email
  → arrive sur /{slug}/admin/dashboard
```

## Étape 8 — Nettoyage

- Suppression de la validation coupon obligatoire actuelle (devient optionnelle)
- `create_event_with_coupon` RPC remplacée par `create_event_from_pending`
- Le coupon admin existant continue de fonctionner (100% gratuit)

## Détails techniques

- **Auth post-paiement** : Magic link via `supabase.auth.admin.generateLink({ type: 'magiclink' })`. Si email n'existe pas dans `auth.users`, Supabase le crée automatiquement.
- **Idempotence webhook** : check `stripe_session_id` unique sur `events` avant insert.
- **Skip plan gratuit** : si `prix_cents = 0` ET pas de paiement à faire → event créé immédiatement via RPC + magic link envoyé.
- **Lieu** conservé sur l'event (table `events.lieu` existe déjà).

## Questions ouvertes avant d'implémenter

1. **Tax handling Stripe** — pour démarrer je propose "no automation" (option 3). OK ?
2. **Page success** : on attend webhook côté client (polling 2s sur Supabase) ou redirect direct vers "vérifiez vos emails" ?
3. **Email domain** pour magic link : as-tu déjà un domaine configuré dans Lovable Cloud → Emails ? Sinon le magic link partira de `noreply@mail.app.brevo.com` (par défaut Supabase) — pas idéal pour la délivrabilité.

Confirme-moi ces 3 points et je lance l'implémentation.
