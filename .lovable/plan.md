## Problème

Vite/Lightning CSS plante avec `ENOENT` parce que `src/styles.css` commence par :

```css
@import url("https://fonts.googleapis.com/css2?family=Josefin+Sans...&family=Public+Sans...");
```

Lightning CSS résout les `@import` depuis le système de fichiers — il essaie de lire l'URL comme un chemin local et fait crasher la compilation de la feuille de style. Résultat : la page n'a plus de CSS et l'overlay d'erreur s'affiche.

C'est un gotcha connu de Tailwind v4 sur ce stack : les polices distantes doivent être chargées via `<link>` dans le `<head>`, pas via `@import` CSS.

## Correctif

1. **`src/styles.css`** — supprimer la ligne 1 (`@import url("https://fonts.googleapis.com/...")`).
2. **`src/routes/__root.tsx`** — ajouter dans le `links` du `head()` de la route racine :
   - `preconnect` vers `https://fonts.googleapis.com`
   - `preconnect` vers `https://fonts.gstatic.com` (crossOrigin)
   - `stylesheet` vers l'URL Google Fonts avec les mêmes familles/poids (Josefin Sans 600;700 + Public Sans 400;600;700, `display=swap`)

Aucun autre fichier touché. Aucune modification du formulaire de bug ni du backend.

## Vérification

- L'overlay Vite disparaît, la page se recharge avec styles.
- Les polices Josefin Sans et Public Sans restent appliquées (404 page, design system).
