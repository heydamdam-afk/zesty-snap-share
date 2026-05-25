
## Diagnostic

Ton assistant se trompe : la connexion invité **n'utilise pas du tout Supabase Auth**. Elle passe par des RPC PostgREST (`find_my_invite`, `find_or_adopt_invite_by_email`) avec un `device_id` stocké en localStorage. Le "Invalid Refresh Token" visible en console vient de `supabase.auth.signOut()` appelé dans le `onLeave` invité (héritage du système admin) — c'est juste un log bruyant, pas la cause.

Le vrai bug est ailleurs, et il explique les deux symptômes que tu décris.

### Cause racine : le `device_id` écrase l'email

Dans `tryReconnectToEvent` (`src/lib/zest-actions.ts`), l'ordre actuel est :

1. **D'abord** lookup par `device_id` → si une invite existe sur cet appareil, on est connecté **quel que soit l'email tapé**.
2. **Ensuite** seulement, lookup par email.

Combiné avec `clearGuestSession({ keepDeviceId: true })` à la déconnexion (qui garde volontairement le device_id), ça donne :

- **Bug "email croisé"** : tu te déconnectes (damdelbret), tu re-tapes Dbreteau ou n'importe quoi → le RPC ignore l'email et renvoie l'invite damdelbret liée au device. Tu es reconnecté sous le mauvais identifiant. Ça matche exactement ton test.
- **Bug "ne se connecte pas tout de suite"** : très probablement le même phénomène. Selon ce qu'a fait l'invite précédente (ex. ban, ou un état incohérent côté state React après le reload), le branchement "match device" tombe sur une invite obsolète.

Le comportement attendu que tu décris ("check de l'email → si ok event, sinon mire prénom/photo") implique que **l'email doit être l'identité primaire**, pas le device.

## Correctif

### 1. Inverser la priorité dans `tryReconnectToEvent` (`src/lib/zest-actions.ts`)

Nouvelle logique :

1. `findEventByCode(code)` + check ban → inchangé.
2. **Si email fourni** : appel `find_or_adopt_invite_by_email`.
   - Si match → reconnexion ok (et la fonction RPC adopte déjà le device_id côté DB).
   - Si pas de match → `new_user` (passage étape 2 prénom/photo).
3. **Seulement si pas d'email** (cas théorique, l'UI l'exige) : fallback device_id.

Conséquence : taper un email différent de celui enregistré sur ce device ne renvoie plus l'ancienne invite — soit on trouve une invite pour ce nouvel email, soit on bascule en création.

### 2. Garde-fou supplémentaire dans le fallback device

Si malgré tout on garde un lookup device_id (ex. pour les admins qui passent par `e.$slug.tsx` `useEffect`), exiger que l'email saisi corresponde à l'email de l'invite trouvée, sinon ignorer le match.

### 3. Nettoyer le bruit "Invalid Refresh Token"

Dans `SessionProvider.signOut`, n'appeler `supabase.auth.signOut()` que si une session Supabase existe réellement (`if (user) await supabase.auth.signOut()`). Ça supprime l'erreur 400 quand un invité pur (sans session admin) se déconnecte.

## Fichiers touchés

- `src/lib/zest-actions.ts` — réordonner `tryReconnectToEvent` (et idéalement `loginToEvent` pour cohérence).
- `src/contexts/SessionProvider.tsx` — appel conditionnel à `supabase.auth.signOut()`.

## Hors scope

- Pas de changement de schéma DB ni de RPC : `find_or_adopt_invite_by_email` fait déjà l'adoption du device_id côté serveur, c'est exactement ce qu'il nous faut.
- Pas de modification de l'UI AccessGate.
- Le système d'auth Supabase pour les **admins** reste inchangé.

## Tests manuels après fix

1. Invité A se connecte avec emailA → ok.
2. Logout, reconnexion immédiate avec emailA → doit re-rentrer direct (via email match).
3. Logout, reconnexion avec emailB (jamais vu) → doit afficher étape 2 (prénom/photo), pas reconnecter sous emailA.
4. Logout, reconnexion avec emailC d'un autre invité existant de l'event → doit se connecter sous emailC, pas sous emailA.
