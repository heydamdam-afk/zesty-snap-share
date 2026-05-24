## Diagnostic

L'audit du codebase montre que l'iPhone 14 (390px) ne souffre PAS d'un débordement horizontal :
- Balise viewport correcte (`width=device-width, initial-scale=1` dans `src/routes/__root.tsx:117`).
- Captures à 390px sur `/` : pas de scroll horizontal, layout propre.
- Les seules largeurs fixes >390px sont les piles de polaroïds (`width:300px/280px`) à l'intérieur de conteneurs `overflow:hidden` — pas de débordement page.
- Les composants shadcn (`Input`, `Textarea`) sont déjà à `text-base` (16px) sur mobile, et le composant `ComposeBar` (modale de publication) utilise `text-base` également.

**Cause réelle du dézoom signalé sur la page de publication** : les classes CSS personnalisées `.gi-input` (formulaire invité, `src/styles.css:486`) et `.ka-input` (login admin, `src/styles.css:390`) sont définies à `font-size:15px`. Quand l'utilisateur saisit prénom/code dans le flux invité avant d'accéder au feed et à la publication, **iOS Safari déclenche un auto-zoom au focus** (règle iOS : zoom si `font-size < 16px`), et la page reste zoomée ensuite. Le rendu donne l'impression que la page « force un dézoom ».

## Changements

### Fix unique et ciblé : iOS auto-zoom

Dans `src/styles.css` :
1. `.gi-input` → passer `font-size:15px` à `font-size:16px`.
2. `.ka-input` → passer `font-size:15px` à `font-size:16px`.

Optionnel défensif (même fichier, sélecteur global) — pour couvrir tout futur input/textarea/select natif :

```css
@media (max-width: 640px) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  select,
  textarea {
    font-size: 16px;
  }
}
```

Ce bloc neutralise le zoom iOS sur n'importe quel champ saisi sans toucher au design (la taille visuelle reste très proche de 15px).

### Pas d'autre changement

- Aucun composant n'a `min-width` ou `width` fixe supérieur à 390px qui déborde du viewport.
- La balise `viewport` est déjà correcte, pas de modification.
- Aucune autre route n'est impactée.

## Vérification

1. Naviguer sur iPhone 14 (390px) vers `/e/{slug}` → entrer code invité → focus sur le champ prénom : plus de zoom-in automatique.
2. Idem sur `/` (login admin) : focus email/mot de passe sans zoom.
3. Ouvrir la modale de publication (ComposeBar) et focus textarea : déjà OK (text-base = 16px), reste OK.
4. Pas de scroll horizontal sur les pages testées.

## Hors scope

- Pas de refonte des polaroïds ni du grid login (ils sont déjà responsive et contenus dans `overflow:hidden`).
- Pas de modification du viewport meta.