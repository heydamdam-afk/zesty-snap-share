# Sélecteur d'events après connexion organisateur

## Contexte actuel

Aujourd'hui, après login sur `/`, la fonction `routeAfterAuth()` :
- récupère `my_admin_events()` (qui retourne déjà tous les events où l'user est admin avec `event_id`, `slug`, `titre`, `role`)
- redirige automatiquement vers le **premier** event → `/$slug/admin/dashboard`
- ou vers `/create-event` si zéro event

Conséquence : impossible de choisir entre plusieurs events, et on atterrit sur le **dashboard de réglages** au lieu du **feed admin**.

## Objectif

Ajouter une nouvelle page **« Mes events »** qui s'affiche après login lorsque l'organisateur a au moins 1 event, listant les events sous forme de cards avec :
- une card par event (titre, lieu, date, cover si dispo, badge rôle)
- un bouton **« Créer un autre event »** → `/create-event`
- clic sur une card → redirige vers le **feed de l'event en mode admin** = `/e/$slug` (qui contient déjà le mode admin via `useAdmin` + `<AdminBookmark>`)

Si zéro event → redirection directe vers `/create-event` (comportement actuel).
Si user non loggé → reste sur `/`.

## Routes & navigation

```text
/  (Landing login)
   │
   ├─ login OK + 0 event   → /create-event
   ├─ login OK + ≥1 event  → /my-events           (NOUVEAU)
   │                            │
   │                            ├─ clic card     → /e/$slug
   │                            └─ "Créer event" → /create-event
   └─ login KO              → reste sur /
```

## Changements de code

### 1. Nouvelle route `src/routes/my-events.tsx`
- `createFileRoute("/my-events")` avec `head()` (title + `noindex`)
- `beforeLoad` : vérifie `supabase.auth.getUser()` → si pas loggé, `redirect({ to: "/" })`
- Dans le composant :
  - `useEffect` : appelle `supabase.rpc("link_admin_user_id")` puis `supabase.rpc("my_admin_events")`
  - charge en parallèle les détails (cover_url, lieu, event_date) via `supabase.from("events").select("id, slug, titre, lieu, cover_url, event_date").in("id", [...])` pour enrichir les cards
  - état loading → skeleton ; zéro event → redirige vers `/create-event` ; sinon affiche grille de cards
- UI cohérente avec le style existant : fond `bg-[image:var(--gradient-warm)]`, header avec `<ZestLogo>` + bouton « Se déconnecter », titre h1 « Mes événements », grille responsive (1 col mobile / 2 cols desktop) de cards `bg-card` arrondies avec cover + titre + lieu + date + badge rôle (organisateur/secondaire), et un bouton CTA primary `+ Créer un autre événement` en haut à droite (et dupliqué en bas si la liste est longue)
- Card = `<Link to="/e/$slug" params={{ slug }}>` (pas de `useNavigate` pour le clic)

### 2. Modifier `src/routes/index.tsx`
- Dans `routeAfterAuth()` : remplacer la redirection directe vers `/$slug/admin/dashboard` par une redirection vers `/my-events` quand `events.length > 0`. Garder `/create-event` quand `events.length === 0`.

### 3. Pas de changement DB
- `my_admin_events()` retourne déjà tout ce qu'il faut. On enrichit côté client avec un `select` sur `events` pour cover/lieu/date.

### 4. Pas de changement sur `/e/$slug`
- Le mode admin y est déjà géré via `useAdmin(eventId)` + `<AdminBookmark>` qui affiche le lien vers `/$slug/admin/dashboard` quand l'utilisateur est admin connecté. L'organisateur arrive donc sur le **feed** et peut accéder aux réglages depuis là.

## Détails UX des cards

Chaque card contient :
- **Cover** : image `cover_url` en aspect 16/9 si dispo, sinon dégradé `bg-[image:var(--gradient-warm)]` avec initiale du titre
- **Titre** event en `font-display`
- **Lieu** + **date formatée** (fr-FR) en `text-muted-foreground`
- **Badge rôle** : `Organisateur` (primary) ou `Admin secondaire` (muted) en haut à droite de la card
- Hover : légère élévation (`hover:shadow-card transition`)

## Edge cases
- Loading initial : skeleton de 2 cards
- Erreur RPC : toast `sonner` + bouton « Réessayer »
- 0 event après chargement : `navigate({ to: "/create-event", replace: true })`
- Déconnexion : bouton header → `supabase.auth.signOut()` puis retour `/`
