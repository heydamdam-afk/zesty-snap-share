## Objectif

Unifier la redirection post-création d'événement (gratuit ET payant) :
- Nouvel utilisateur sans mot de passe → `/login?mode=set-password&redirect=/{slug}/admin/dashboard`
- Utilisateur existant avec mot de passe → `/login?redirect=/{slug}/admin/dashboard`

Et supprimer l'envoi automatique du « login link » par email.

## Sur le cas Lisa

Dans la base : `has_password = true`, `last_sign_in_at = 2026-05-29 12:25`. Lisa a donc déjà un mot de passe et s'est déjà connectée. Pour elle, le flow correct est CAS 2 (login classique). Le message « pas admin de ce compte » vient d'une vérification côté dashboard après login : si la session active correspond à un autre email que celui qui a payé l'événement, la vérification `event_admins` échoue. La correction de la redirection ne change pas ce point — elle garantit juste qu'on atterrit sur le bon écran de login dès le départ.

## Changements

1. `src/lib/create-event.functions.ts`
   - Dans `createCheckoutSession`, pour la branche `finalCents === 0` (free) :
     - Supprimer l'appel à `sendMagicLinkInternal`.
     - Calculer `needsSetPassword` via `get_auth_user_summary_by_email`.
     - Retourner `{ mode: 'free', slug, eventId, needsSetPassword }`.
   - Supprimer la fonction `sendMagicLinkInternal` et `resendMagicLinkForSession` (plus utilisées). Vérifier qu'aucun autre fichier ne les importe.

2. `src/routes/create-event.checkout.tsx`
   - Quand `result.mode === 'free'` : remplacer la navigation vers `/create-event/success` par un `window.location.replace` direct vers `/login?...&redirect=/{slug}/admin/dashboard`, avec `mode=set-password` si `result.needsSetPassword`.

3. `src/routes/create-event.success.tsx`
   - Conserver le polling pour la branche payante (utilise déjà `lookupEventBySessionId` qui gère déjà `needsSetPassword`).
   - Nettoyer les chemins morts liés au magic link s'il y en a.

4. Vérification ciblée (sans browser, juste lecture/logs)
   - Vérifier qu'aucun import résiduel ne référence `resendMagicLinkForSession` / `sendMagicLinkInternal`.
   - Relire `routeAfterAuth` pour confirmer que la redirection `?redirect=...` est bien respectée après login.

## Hors-scope

- Le message « pas admin de ce compte » lors d'un mismatch de session : non corrigé ici, c'est un autre sujet (gestion d'une session déjà active sur un autre compte au moment du paiement). À traiter dans un prochain ticket si besoin (par ex. : forcer un `signOut` avant d'atterrir sur `/login` post-paiement).