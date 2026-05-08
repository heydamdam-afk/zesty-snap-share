## Bug

`ComposeBar` est monté avant que `guest.invite.id` soit disponible. Quand l'invité clique "Publier", `createPost` reçoit un `inviteId` invalide et lève l'erreur `"Session invité invalide"` — l'upload échoue silencieusement.

S'ajoute une fuite mémoire : `URL.createObjectURL` est appelé à chaque render sans cleanup → previews qui clignotent / disparaissent sur mobile.

## Fix en 3 parties

### 1. `src/routes/e.$slug.tsx` — guard côté parent

Ne plus rendre `ComposeBar` tant que la session invité n'est pas complète.

```tsx
// Avant
<ComposeBar guest={guest} onPosted={reload} />

// Après
{guest?.invite?.id && guest?.event?.id && (
  <ComposeBar guest={guest} onPosted={reload} />
)}
```

### 2. `src/components/zest/ComposeBar.tsx` — garde défensive dans `submit()`

```tsx
const submit = async () => {
  if (!guest?.invite?.id || !guest?.event?.id) {
    toast.error("Session expirée — recharge la page");
    return;
  }
  if ((!text.trim() && files.length === 0) || busy) return;
  // … reste inchangé
};
```

### 3. `src/components/zest/ComposeBar.tsx` — fix fuite mémoire previews

Remplacer le `useMemo` actuel (qui flag HEIC/`isUnsupported` et fait disparaître certaines previews) par un `useState` + `useEffect` qui crée les URLs **une seule fois** par changement de `files` et les révoque au cleanup.

```tsx
const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);

useEffect(() => {
  const urls = files.map((f) => ({
    name: f.name,
    url: URL.createObjectURL(f),
  }));
  setPreviews(urls);
  return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
}, [files]);
```

Et simplifier le rendu des previews : un seul `<img src={p.url} />` (plus de branche fallback `isUnsupported`/HEIC qui masquait les previews JPEG normales).

Garder `onError` + `reportImageError` pour le diagnostic, mais sans le fallback "Image".

## Effets

- L'upload depuis la photothèque fonctionne dès que la session est prête.
- Plus de previews blanches/clignotantes sur iOS et Android.
- Plus de fuite mémoire sur les sélections multiples.
- Si la session expire en cours d'usage, l'utilisateur voit un toast clair au lieu d'un échec silencieux.

## Fichiers modifiés

- `src/routes/e.$slug.tsx` — wrap `<ComposeBar>` dans la condition.
- `src/components/zest/ComposeBar.tsx` — guard `submit`, remplacement `useMemo` par `useState`+`useEffect`, suppression du fallback HEIC/`isUnsupported` et de l'import `ImageIcon`.