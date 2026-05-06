## Problèmes identifiés

1. **Crash de la mire invitée** : quand vous cliquez « Rejoindre la galerie », `buildSession` plante avec `Cannot read properties of null (reading '0')`. L'invite renvoyée par la base contient un `prenom` à `null` (probablement créé lors d'une tentative précédente d'auto-session admin), et `invite.prenom[0]` casse.

2. **Redirection « Mes événements » → mire** : actuellement, cliquer sur une carte d'événement vous emmène sur `/e/{slug}` (page invité). Pour un organisateur, il faut aller directement au tableau de bord admin `/{slug}/admin/dashboard`.

## Corrections

### 1. `src/lib/zest-session.ts`
Sécuriser `buildSession` contre un `prenom` vide ou null :
- utiliser `invite.prenom ?? ""` avant d'accéder à `[0]`
- même fallback pour `pickAvatarColor`

### 2. `src/routes/my-events.tsx`
Pour chaque carte :
- si `role === "organisateur"` → `<Link to="/$slug/admin/dashboard">`
- si `role === "secondaire"` → garder `<Link to="/e/$slug">` (feed)

Le badge « Organisateur / Admin secondaire » reste affiché.

### 3. Données : nettoyer l'invite cassée
Vérifier en base s'il existe un invite avec `prenom IS NULL` ou `prenom = ''` pour votre user sur cet événement, et le corriger (mettre votre prénom ou supprimer la ligne) pour que la session admin auto se reconstruise proprement la prochaine fois.

## Résultat attendu
- Depuis « Mes événements », clic sur la carte → arrivée directe sur le dashboard admin (organisateur) ou sur le feed (admin secondaire), sans passer par la mire.
- La mire invitée ne plante plus si un invite mal formé existe.
