## Objectifs

1. Sur l'écran `/admin` en mode "Créer un compte admin" : ajouter un champ **Prénom** (obligatoire) et un champ **Photo de profil** (optionnelle).
2. Renommer toutes les occurrences visibles de **Zest / Zeste / zest.** en **Kapsul** dans l'UI.

---

## 1. Création de compte admin enrichie (`src/routes/admin.tsx`)

### Champs ajoutés (mode signup uniquement)

- **Prénom** — obligatoire, 2–40 caractères, validé via Zod côté client.
- **Photo de profil** — optionnelle, JPG/PNG/WebP, 5 Mo max, prévisualisation ronde avec initiale + couleur fallback (réutilise `pickAvatarColor` de `zest-session.ts` pour cohérence visuelle avec l'AccessGate invité).

UI : même style que `AccessGate.tsx` (badges "Obligatoire" / "Optionnelle", input rond pour avatar avec initiale colorée, bouton "Choisir une photo").

### Stockage

- **Prénom** → colonne `event_admins.prenom` (existe déjà, nullable, jamais peuplée jusqu'ici).
- **Photo** → bucket Supabase Storage `event-photos` (existe déjà, public), sous-dossier `admin-avatars/{user_id}.{ext}`. URL publique stockée dans une nouvelle colonne `event_admins.avatar_url` (text, nullable).

### Migration DB

```sql
ALTER TABLE public.event_admins
  ADD COLUMN avatar_url text;
```

(La colonne `prenom` existe déjà — rien à faire côté schéma pour ça.)

### Flux signup

1. Validation Zod (email, password, prénom).
2. `supabase.auth.signUp({ email, password, options: { data: { prenom, avatar_url } } })` — stocke en metadata pour fallback.
3. Si fichier avatar fourni : upload dans `event-photos/admin-avatars/{user.id}.{ext}` après signup, récupération de la public URL.
4. **Mise à jour des lignes `event_admins`** correspondant à cet email :
   - Appel `supabase.rpc("link_admin_user_id")` (déjà fait, lie `user_id`).
   - `UPDATE event_admins SET prenom = ?, avatar_url = ? WHERE lower(email) = lower(?) AND (prenom IS NULL OR avatar_url IS NULL)` — la policy RLS `admin_can_self_update` autorise déjà cet update (`lower(email) = current_admin_email()`).
5. Suite du flux existant inchangée (bookmark / dashboard).

### Flux signin

Inchangé — pas de nouveaux champs affichés.

---

## 2. Renommage "Zest" → "Kapsul"

Remplacer dans **tout le code source** (UI uniquement, pas les clés localStorage/identifiants techniques) :

- `src/components/zest/Logo.tsx` : `zest` → `kapsul` (le `.` final reste, donc "kapsul.").
- Titres de pages (route `head().meta.title`) :
  - `src/routes/admin.tsx` → "Espace admin — Kapsul"
  - `src/routes/$slug.admin.dashboard.tsx` → "Tableau de bord admin — Kapsul"
  - `src/routes/$slug.admin.index.tsx` → "Espace admin — Kapsul"
  - `src/routes/closed.tsx` → "Galerie fermée — Kapsul"
  - `src/routes/dashboard.tsx` → "Redirection dashboard — Kapsul"
  - `src/routes/e.$slug.tsx` → "Kapsul — Galerie photo de votre événement"
  - `src/routes/__root.tsx` → meta description / og:title / twitter:description : "Kapsul Photo Hub..."
- Texte visible "Propulsé par **Zeste**" dans `AccessGate.tsx` → "Propulsé par **Kapsul**".
- Texte visible "Cette galerie Zest est maintenant fermée." dans `closed.tsx` → "Cette galerie Kapsul est maintenant fermée."

**À NE PAS toucher** (clés techniques, casseraient les sessions existantes) :
- `zeste_device_id`, `zeste_guest_session`, `zeste_login_attempts`, `zeste_login_lock_until`, `zeste_admin_onboarded` dans localStorage.
- Chemins de dossiers `src/components/zest/`, `src/lib/zest-actions.ts`, etc. (refactor lourd sans valeur immédiate, et risque de casser des imports).
- Le composant exporté `ZestLogo` (renommer le symbole impliquerait de mettre à jour ~10 imports — on garde le nom du composant mais on change ce qu'il affiche).

---

## Fichiers modifiés

- **migration SQL** : ajout colonne `event_admins.avatar_url`
- `src/routes/admin.tsx` (form signup enrichi + upload avatar + update event_admins)
- `src/components/zest/Logo.tsx` (texte affiché)
- `src/routes/__root.tsx`, `src/routes/admin.tsx`, `src/routes/$slug.admin.dashboard.tsx`, `src/routes/$slug.admin.index.tsx`, `src/routes/closed.tsx`, `src/routes/dashboard.tsx`, `src/routes/e.$slug.tsx` (titres et descriptions)
- `src/components/zest/AccessGate.tsx` ("Propulsé par Zeste" → "Kapsul")

---

## Questions ouvertes

- Le **prénom** doit-il aussi être affiché dans l'`AdminHeader` à la place / à côté de l'email une fois connecté ? (Pas inclus pour l'instant — peut être fait dans un second temps si tu veux.)
- L'**avatar admin** doit-il apparaître quelque part dans l'UI admin (header, liste des admins de la section "Admins") ? Si oui je l'ajoute aussi — sinon la donnée est juste stockée pour usage futur.
