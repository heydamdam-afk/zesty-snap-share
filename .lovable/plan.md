## Diagnostic

Ce que tu vois sur les captures, ce n'est **pas** un défaut de notre modale — c'est la **barre d'AutoFill iOS** (clé 🔑 / carte 💳 / localisation 📍 / ✓) que Safari/Chrome/Brave affichent **au-dessus du clavier** dès qu'un champ texte a le focus. Sur la 2e capture on voit même que le suggestion bar pousse la modale et masque le textarea — c'est le comportement natif iOS, pas un bug CSS.

## La solution de Claude est correcte mais incomplète

`autocomplete="off"` seul **ne suffit pas sur iOS Safari** : iOS ignore souvent `off` pour des raisons d'accessibilité et continue d'afficher la barre AutoFill. Il faut combiner plusieurs attributs + utiliser des **valeurs `autocomplete` reconnues mais non sensibles** (le truc qui marche vraiment sur iOS).

## Plan proposé

### 1. Champ commentaire / texte de post (`Textarea` dans `ComposeBar.tsx`)
C'est le cas critique (capture 2). Ajouter :
```
autoComplete="off"
autoCorrect="on"          // garder la correction utile pour un message
autoCapitalize="sentences"
spellCheck={true}         // utile pour un post
name="post-content"       // nom non-sensible
```
→ La barre AutoFill (clé/carte) **disparaît** car iOS ne propose pas de remplissage pour un nom inconnu non-sensible.

### 2. Champ prénom (`AccessGate` + `ProfileDialog`)
```
autoComplete="given-name"   // valeur standard, utile, pas de barre clé/carte
autoCorrect="off"
autoCapitalize="words"
spellCheck={false}
```

### 3. Champ email (`AccessGate` + `ProfileDialog`)
```
type="email"
inputMode="email"
autoComplete="email"        // garder — utile et n'affiche pas la barre clé/carte
autoCorrect="off"
autoCapitalize="off"
spellCheck={false}
```

### 4. Code d'accès événement (`AccessGate`)
```
autoComplete="off"
autoCorrect="off"
autoCapitalize="characters" // si codes en majuscules
spellCheck={false}
inputMode="text"
name="event-code"           // nom non-sensible → pas de proposition mot de passe
```
**Important** : NE PAS utiliser `type="password"` ni un `name` contenant "password"/"code"/"otp" — sinon iOS propose le trousseau.

### 5. Recherche éventuelle / autres inputs
Audit rapide des autres `Input`/`Textarea` du projet pour appliquer la même hygiène.

## Fichiers à modifier

- `src/components/zest/ComposeBar.tsx` — textarea du post
- `src/components/zest/AccessGate.tsx` — prénom, email, code d'accès
- `src/components/zest/ProfileDialog.tsx` — prénom, email
- (audit) autres formulaires : `create-event.tsx`, `OrganisateurLoginModal.tsx`, `reset-password.tsx`

## Pourquoi pas seulement `autocomplete="off"`
- iOS Safari ignore `off` sur les inputs texte génériques → la barre clé/carte reste.
- La parade qui marche réellement : utiliser un `name` non-sensible + valeur `autocomplete` non-sensible (ex: `given-name`, `email`, ou un nom inventé comme `post-content`). iOS n'a alors **rien à proposer** et masque la barre.
- `spellcheck` et `autocapitalize` n'enlèvent pas la barre AutoFill mais améliorent l'UX (notamment éviter la majuscule auto sur email).

## Hors scope (à confirmer)
- Aucun changement de logique métier, juste des attributs HTML.
- Aucun changement de design.

Veux-tu que j'applique ce plan tel quel ?