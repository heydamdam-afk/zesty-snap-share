## Objectif
Corriger le blocage quand un invité saisit son email et son code d’accès sur une page événement.

## Ce que je vais modifier
1. **Sécuriser le submit invité**
   - Ajouter une gestion d’erreur explicite autour de la vérification code/email.
   - Éviter que le bouton reste en chargement ou que l’écran semble bloqué si une requête échoue.

2. **Corriger les erreurs non affichées**
   - Si la recherche de l’événement, la vérification admin, ou les fonctions d’invité échouent, afficher un message clair au lieu d’un blocage silencieux.
   - Réactiver correctement le bouton après l’erreur.

3. **Nettoyer le cas “session locale incohérente”**
   - Si une ancienne session invité ou admin interfère avec l’accès invité, la nettoyer localement avant de retenter l’entrée.
   - Ne pas supprimer le code/email saisis par l’utilisateur.

4. **Conserver le comportement existant**
   - Code incorrect : compteur de tentatives inchangé.
   - Invité existant : entrée directe dans la galerie.
   - Nouvel invité : passage à l’étape prénom/avatar.
   - Organisateur détecté : proposition d’accès espace admin.

## Fichiers concernés
- `src/components/zest/AccessGate.tsx`
- éventuellement `src/lib/zest-actions.ts` si l’erreur vient d’une fonction de validation trop fragile.

## Validation
Après correction, je vérifierai que le parcours code + email ne reste plus bloqué et qu’un message utilisateur apparaît en cas d’échec réseau/base/auth.