
## 1. Bouton "Voir le feed" sur le dashboard admin

Dans `src/components/zest/admin/AdminHeader.tsx`, à côté du bouton "Galerie" (qui pointe vers `/` = My Events), ajouter un second bouton **"Voir le feed"** qui ouvre directement l'événement courant.

- Lien : `to="/e/$slug"` avec `params={{ slug: event.slug }}`
- Icône : `Eye` (lucide-react)
- Style : même look que le bouton existant (variante outline)
- Visible aussi en mobile (le "Galerie" actuel est `hidden sm:inline-flex` — on rendra le nouveau visible partout, ou on les regroupe dans un petit menu si l'espace manque sur mobile)
- Renommer "Galerie" en **"Mes events"** pour que la distinction soit claire (Galerie = liste de mes events ; Voir le feed = ce feed-ci)

L'organisateur a déjà une session admin auto-créée par `e.$slug.tsx` (logique déjà en place), donc le clic l'amène directement sur le feed sans repasser par la mire invitée.

## 2. Photo de couverture à la création d'event

### 2.a — Texte d'aide sous le champ (`src/routes/create-event.tsx`)

Ajouter sous l'input `cover` :

> Format JPG, PNG ou WebP. Max **5 Mo**. Recommandé : **1600×900 px** minimum (ratio 16:9), 200 Ko – 2 Mo pour un bon rendu.

Validation client immédiate au `onChange` :
- type ∈ {jpeg, png, webp}
- taille ≤ 5 Mo
- dimensions min 800×450 (lecture via `Image()` + `naturalWidth/Height`)
- En cas d'erreur : `toast.error(...)` + reset du champ ; on n'enregistre `coverFile` que si valide.

### 2.b — Upload effectif de la photo

Aujourd'hui, `coverFile` est uploadé via `uploadOnePhoto` mais **`events.cover_url` n'est jamais mis à jour** (pas de policy UPDATE sur `events` côté client) — la photo est perdue.

Solution : nouvelle RPC `set_event_cover(_event_id uuid, _cover_url text)` (SECURITY DEFINER) qui vérifie que `auth.uid()` est admin de l'event, puis fait l'`UPDATE events SET cover_url = _cover_url WHERE id = _event_id`.

Migration SQL :
```sql
create or replace function public.set_event_cover(_event_id uuid, _cover_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_admin(_event_id, auth.uid()) then
    raise exception 'not_admin';
  end if;
  if _cover_url is null or char_length(_cover_url) > 2048 then
    raise exception 'invalid_cover_url';
  end if;
  update public.events set cover_url = _cover_url where id = _event_id;
  return true;
end;
$$;
```

Côté client, dans `create-event.tsx` après `createEventWithCoupon`, si `coverFile` est présent :
1. Upload vers Supabase Storage bucket `event-photos` au chemin `covers/{event_id}/{ts}.{ext}` (même pattern que `EventSettingsSection.handleCoverChange`) — pas via R2/`uploadOnePhoto` qui crée un post.
2. `getPublicUrl` → `cover_url`
3. `supabase.rpc("set_event_cover", { _event_id: result.event_id, _cover_url: publicUrl })`
4. Si l'une des étapes échoue : `toast.warning("Event créé mais photo non enregistrée — réessayez via le dashboard")` et on continue la redirection.

Retirer la ligne actuelle :
```ts
toast.info("Photo de couverture : à ajouter ensuite via le tableau de bord admin");
```

### 2.c — Cohérence côté dashboard (`EventSettingsSection.tsx`)

Mettre à jour le texte d'aide existant pour qu'il matche les nouvelles règles :
> JPG / PNG / WebP — max 5 Mo — recommandé 1600×900 px

Et appliquer la même validation dimensions (mêmes seuils) dans `handleCoverChange`.

## Fichiers touchés

- `src/components/zest/admin/AdminHeader.tsx` — ajout bouton "Voir le feed", renommage "Galerie" → "Mes events"
- `src/routes/create-event.tsx` — validation + upload réel de la cover via storage + RPC
- `src/components/zest/admin/EventSettingsSection.tsx` — texte d'aide + validation dimensions alignés
- `supabase/migrations/<ts>_set_event_cover.sql` — nouvelle fonction `set_event_cover`

## Détails techniques

- La RPC est nécessaire car la table `events` n'a aucune policy UPDATE pour `authenticated`. Plutôt qu'ouvrir une policy générale, on cible précisément ce besoin.
- L'upload depuis create-event utilise Supabase Storage (bucket public `event-photos`), pas R2 — c'est le pattern déjà utilisé par `EventSettingsSection` pour les covers.
- Validation dimensions via `URL.createObjectURL` + `<img>` `onload` ; revoke après lecture.
