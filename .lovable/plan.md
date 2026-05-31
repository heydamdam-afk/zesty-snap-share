# Plafond 25 photos – upload galerie

## Objectif
Empêcher la sélection de plus de 25 photos en une seule fois via le bouton "Ajouter mes photos" de la galerie, avec un message clair pour l'utilisateur. La concurrence d'upload (5 en parallèle) reste inchangée.

## Changements

### 1. `src/lib/zest-actions.ts`
- Ajouter une constante exportée `MAX_GALLERY_PHOTOS_PER_BATCH = 25`.
- Dans `uploadGalleryBatch`, throw une erreur explicite si `files.length > 25` (filet de sécurité côté logique, en plus de la garde UI).

### 2. `src/routes/e.$slug.tsx` (`handleUpload`)
- Après validation taille/format, si `valid.length > 25` :
  - Garder uniquement les 25 premiers fichiers.
  - Afficher un `toast.error` : « Maximum 25 photos par envoi. Les X photos supplémentaires ont été ignorées. »
- Continuer l'upload normalement avec ces 25 fichiers.

### 3. `src/components/zest/FloatingUploadButton.tsx`
- Aucune modif fonctionnelle nécessaire (l'input `multiple` reste ouvert) — la garde se fait dans `handleUpload` pour conserver un seul point de vérité et bien gérer le cas où des fichiers ont déjà été filtrés (trop gros, mauvais format).

## Hors scope
- Pas de changement de concurrence.
- Pas de retry/backoff.
- Pas de modif serveur (`/api/public/r2-upload`).
- Pas de batch séquentiels au-delà de 25 (l'utilisateur fera plusieurs envois).
