## Problème

Le bottom sheet actuel (`Drawer` vaul) sur mobile :
- Affiche une barre de scroll latérale visible
- Crée un scroll infini parasite à l'intérieur
- Bloque l'accès au bouton "Ajouter des photos" quand le clavier est ouvert (zone masquée)
- Le verrouillage `body { position: fixed }` interagit mal avec vaul

## Solution : modale plein écran

Remplacer le `Drawer` (vaul) par une modale **fullscreen fixe** dans `src/components/zest/ComposeBar.tsx`. Plus de bottom sheet, plus de hauteur calculée, plus de conflit avec le clavier.

## Structure cible

```text
[Header fixe]      ← X fermer / titre / bouton Publier
─────────────────
[Zone scrollable]  ← avatar + textarea + previews photos
─────────────────
[Footer fixe]      ← bouton "Ajouter des photos"
                    (safe-area-inset-bottom)
```

## Détails techniques

- Supprimer `Drawer` / `DrawerContent` / vaul → utiliser un simple overlay :
  ```tsx
  <div className="fixed inset-0 z-50 flex flex-col bg-background">
  ```
- Header sticky en haut avec bouton **Publier** déplacé ici (toujours visible, jamais masqué par le clavier).
- Zone centrale `flex-1 overflow-y-auto` pour le textarea + previews uniquement.
- Footer sticky en bas avec le bouton **Ajouter des photos** + `pb-[env(safe-area-inset-bottom)]`.
- Retirer tout le `useEffect` de body-lock (plus nécessaire, l'overlay couvre tout).
- Retirer `overscroll-contain`, `h-[75vh]`, etc.
- Gérer la fermeture via touche Échap + bouton X.
- Animation d'entrée légère (fade + slide-up) avec framer-motion (déjà dans le projet).

## Comportement attendu

- Ouverture → l'app entière disparaît derrière la modale plein écran (pas d'overlay translucide qui laisse voir la galerie)
- Clavier qui s'ouvre → pousse uniquement le textarea, le bouton **Publier** reste visible en haut
- Bouton **Ajouter des photos** toujours accessible en bas (au-dessus du clavier ou visible quand le clavier est fermé)
- Aucune barre de scroll latérale, aucun scroll de la page derrière

## Fichier modifié

- `src/components/zest/ComposeBar.tsx` (réécriture du JSX du modal + suppression de l'effet body-lock)

Aucune autre modification (logique `createPost`, hooks, etc. inchangée).
