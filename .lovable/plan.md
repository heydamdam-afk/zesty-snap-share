## Problème

Le bouton « Me connecter » du site marketing (kapsul.events) pointe vers `https://app.kapsul.events/my-events`. La logique actuelle de `/my-events` cause la redirection en cascade :

```text
/my-events
  ├─ beforeLoad : si pas de session → redirige vers "/"
  │       └─ "/" (Landing) : si une session existe → routeAfterAuth()
  │             ├─ events.length > 0 → /my-events    (boucle)
  │             └─ events.length === 0 → /create-event
  │
  └─ load() : si events.length === 0 → navigate("/create-event", replace: true)
```

Deux cas posent problème quand l'utilisateur arrive sur `/my-events` via le bouton « Me connecter » :

1. **Session existante mais sans événements** → `/my-events` redirige automatiquement vers `/create-event` (paramètre `?plan=` éventuellement passé par le lien marketing, ou vide, conservé tel quel).
2. **Pas de session** → redirige vers `/` (Landing/login). Si une session reliquat traîne, on retombe dans le cas 1.

Résultat observé : « Me connecter » envoie immédiatement vers `/create-event?plan=` au lieu de présenter la page de connexion ou la liste vide.

## Correctif

### 1. `src/routes/my-events.tsx`
- **Supprimer la redirection automatique** vers `/create-event` quand la liste est vide (`if (list.length === 0) navigate({ to: "/create-event" })`).
- À la place, afficher un **état vide** dans la page : titre, court message (« Vous n'avez pas encore d'événement »), et un bouton CTA « Créer mon premier événement » → `/create-event` (sans paramètre `plan`).
- Garder le `beforeLoad` actuel qui redirige vers `/` si l'utilisateur n'est pas connecté — mais le rediriger vers `/login` plutôt que `/` pour que l'intention « Me connecter » soit explicite (les deux routes rendent le même composant `Landing`, mais `/login` est noindex et plus parlant).

### 2. `src/routes/index.tsx` — `routeAfterAuth`
- Quand `events.length === 0`, **ne plus rediriger vers `/create-event`**. Rediriger vers `/my-events` dans tous les cas où une session existe. La page `/my-events` gère désormais l'état vide.
- Conserver le respect du paramètre `?redirect=` interne.

### Effet
- « Me connecter » (lien externe vers `/my-events`) :
  - non connecté → page `/login` (formulaire de connexion).
  - connecté avec événements → liste des événements.
  - connecté sans événement → page `/my-events` avec état vide + CTA explicite vers création.
- Plus aucun saut silencieux vers `/create-event?plan=`.

## Hors-périmètre
- Pas de modification du site marketing externe (kapsul.events).
- Pas de modification du tunnel `/create-event/checkout` ni de `create-event.functions.ts`.
- Aucun changement de style général : on réutilise les classes Tailwind déjà présentes dans `/my-events` (carte `bg-card`, `shadow-card`, bouton `bg-primary`).
