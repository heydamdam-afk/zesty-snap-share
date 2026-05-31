# Galerie ≠ Feed : ne plus créer de post pour les uploads galerie

## Problème

Aujourd'hui, `uploadGalleryBatch` (bouton "Ajouter mes photos" dans l'onglet Galerie) crée **un post par photo** dans la table `posts`. Comme le feed lit toutes les lignes de `posts` qui ont au moins une photo, ces uploads remontent dans le feed → 6 photos = 6 posts.

On veut :
- **Upload via ComposeBar (Feed)** → crée un post visible dans le feed, photos aussi visibles dans la galerie. (déjà OK)
- **Upload via bouton galerie** → photos visibles dans la galerie uniquement, **aucun post** dans le feed.

## Approche

Ajouter un flag `gallery_only` sur `posts`. Les uploads galerie créent toujours des lignes `posts` + `post_photos` (pour ne pas casser likes/commentaires/suppression qui ciblent `post.id`), mais le feed les ignore. La galerie continue de lire toutes les photos.

## Changements

### 1. Migration SQL
- `ALTER TABLE public.posts ADD COLUMN gallery_only boolean NOT NULL DEFAULT false;`
- Index partiel pour le feed : `CREATE INDEX posts_feed_idx ON public.posts (event_id, created_at DESC) WHERE gallery_only = false;`
- (Pas de backfill : les anciens posts gardent `false`, c'est-à-dire visibles dans le feed comme avant. Si tu veux nettoyer le feed actuel de Lisa, on pourra faire un UPDATE ciblé après coup.)

### 2. `src/lib/zest-actions.ts` — `uploadGalleryBatch`
- Insérer chaque post avec `gallery_only: true`.
- Le reste (upload R2 + `post_photos`) inchangé.

### 3. `src/hooks/useEventFeed.ts`
- Ajouter `.eq("gallery_only", false)` sur la requête `posts`.
- Realtime : ignorer les INSERT dont `payload.new.gallery_only === true`.

### 4. `src/routes/e.$slug.tsx`
- Le calcul `stats.photos` continue de compter via `posts` → comme le feed exclut désormais les gallery-only, il faut soit :
  - garder le compteur basé sur `posts` (sous-estimé) — non,
  - **préférable** : faire un second fetch léger (ou exposer un `galleryPosts` séparé via `useEventFeed`) pour compter toutes les photos de l'event.
- Choix : ajouter un retour `allPhotosCount` dans `useEventFeed` (requête `count` sur `post_photos` filtrée par `event_id` via jointure) pour garder un compteur exact.

### 5. `Gallery` component
- Inchangé côté UI : il faut lui passer **toutes** les photos (feed + gallery_only). On expose donc depuis `useEventFeed` un second tableau `galleryPosts` (posts incluant gallery_only) ou on fait `posts` = tous + on filtre côté Feed render. Plus simple : `useEventFeed` retourne `{ feedPosts, galleryPosts }` ; `feedPosts` exclut gallery_only, `galleryPosts` inclut tout.

## Détails techniques

- Suppression : `deletePost(postId)` continue de fonctionner pour les deux types (RLS basée sur event admin / ownership via device_id).
- Likes/commentaires sur photos gallery-only : non exposés (pas de PostCard rendu), donc no-op fonctionnel.
- Pas de changement Stripe / auth / RLS.

## Hors scope

- Pas de migration des posts existants (ceux créés avant ce fix restent dans le feed).
- Pas de refonte du modèle `posts` / pas de table `gallery_photos` séparée (over-engineering pour ce besoin).
