## Objectif

Supprimer la page `/admin` (doublon) et garder uniquement l'écran de connexion/inscription porté par la landing (`/`), qui est déjà celui affiché après la redirection depuis `/my-events`.

## Changements

1. **Supprimer `src/routes/admin.tsx`**
   - La route `/admin` n'existera plus. `routeTree.gen.ts` se régénère automatiquement.

2. **Supprimer `src/components/zest/AdminBookmark.tsx`**
   - Composant utilisé uniquement par `admin.tsx` (vérifié via ripgrep). Plus aucune référence après suppression.

3. **Mettre à jour `src/routes/dashboard.tsx`**
   - Remplacer les deux `to: "/admin"` (redirection si pas de session + lien d'erreur "Se connecter") par `to: "/"` pour pointer vers la landing qui héberge le formulaire de connexion.

4. **Conserver `/login`** (alias léger de la landing, déjà en place) — il sert au SEO/robots noindex et ne fait pas doublon visuel puisqu'il rend exactement le même composant `Landing`.

## Vérifications post-changement

- `rg "/admin\"|to=\"/admin|'/admin'"` ne doit plus rien retourner en dehors des chemins `$slug/admin/...` (dashboards d'event, qui sont distincts).
- Le flux : utilisateur non connecté → `/my-events` → redirect `/` → formulaire de login → succès → `/dashboard` → `/my-events` ou `/$slug/admin/dashboard` fonctionne sans `/admin`.
- Build TanStack passe (routeTree régénéré sans `/admin`).

## Hors scope

- Aucune modification du formulaire de connexion lui-même, ni de `/login`, `/my-events`, ou des dashboards d'événement (`$slug.admin.*`).