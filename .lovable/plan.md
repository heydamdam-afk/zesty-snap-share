## Objectif

Quand un utilisateur tape `kapsul.events` (route `/`), il atterrit sur une page **organisateur** (login + signup), pas sur la galerie d'event hardcodée actuelle. Après connexion → page de création d'event. Avec un champ **coupon** pour création gratuite illimitée (codes que toi seul peux générer).

---

## Architecture des routes

```
/                       → NOUVELLE page d'atterrissage organisateur (login/signup)
/create-event           → Formulaire de création d'event (auth requise)
/create-event/success   → Page succès avec QR + lien de partage
/e/$slug                → (renommer) Galerie invité actuelle
                          (l'ancien `/` qui chargeait JULIE2026 est déplacé ici)
/admin                  → reste tel quel (login admin existant)
/$slug/admin/...        → reste tel quel
```

**Note sur la galerie invité** : l'actuelle route `/` charge un event hardcodé (`JULIE2026`). On la déplace vers `/e/$slug` pour que `/` devienne la vraie landing kapsul.events. Les QR codes et liens partagés pointeront désormais vers `/e/{slug}` au lieu de `/?code=...`. Le flux `?code=` existant continue de marcher via un petit redirect sur `/`.

---

## 1. Page `/` — Landing organisateur (`src/routes/index.tsx`)

Reprend l'UI de `OrganisateurLoginModal` / `routes/admin.tsx` (carte centrée, gradient warm, ZestLogo, inputs arrondis, bouton primary).

**Contenu** :
- Hero court : "Créez votre galerie photo d'événement en 1 minute"
- Carte avec onglet **Connexion / Inscription**
- Email + password
- Mode signin → si user a déjà des events → redirect `/$slug/admin/dashboard` du dernier ; sinon → `/create-event`
- Mode signup → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin + "/create-event" } })` → écran "Vérifiez votre email" (pas d'auto-confirm, on garde le flow par défaut Lovable Cloud)
- Si user déjà loggé en arrivant sur `/` → redirect direct vers `/create-event` (ou dashboard si events existants)
- Petit lien discret en bas : "J'ai un code d'accès invité →" qui ouvre un input pour saisir un code et redirige vers `/e/{slug}` correspondant

**Rétro-compat** : si `/` est ouverte avec `?code=XXXX` (anciens QR), on retrouve l'event par code et on redirige vers `/e/{slug}?code=XXXX`.

---

## 2. Page `/create-event` (`src/routes/create-event.tsx`)

Auth requise (`beforeLoad` qui check `supabase.auth.getUser()`, sinon redirect `/`).

Carte avec form (mêmes styles que la mire de connexion) — **tous les champs remplis dès la création** :

| Champ | Type | Validation Zod |
|---|---|---|
| Titre | text | 3-120 chars |
| Date de l'événement | datetime-local | requis, > maintenant |
| Lieu | text | 1-200 chars |
| Cover (photo) | file upload R2 | optionnel, max 10 Mo, jpg/png/webp |
| Contact (email/tel) | text | 1-200 chars |
| **Code coupon** | text | optionnel |

**Génération auto** :
- `slug` = slugify(titre) + suffixe court si collision
- `code_acces` = 6 chars alphanumériques uppercase, unique

**Logique coupon** :
- Si pas de coupon → message "🚧 Plan payant à venir — pour l'instant un coupon est requis" + bouton désactivé. (À ajuster quand Stripe arrivera, mais ça t'évite que n'importe qui crée des events gratuits maintenant.)
- Si coupon valide → création autorisée

---

## 3. Système de coupons

### Nouvelle table `event_coupons`
```sql
create table public.event_coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,            -- ex: "FREEKAPSUL2026"
  type text not null default 'free_event', -- pour évolution future
  max_uses integer,                      -- null = illimité
  uses_count integer not null default 0,
  expires_at timestamptz,                -- null = pas d'expiration
  created_by uuid,                       -- toi (super admin)
  created_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.event_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.event_coupons(id),
  event_id uuid not null,
  redeemed_by uuid not null,
  redeemed_at timestamptz not null default now()
);
```

### Super admin (toi)
Nouvelle table légère pour identifier les super-admins kapsul (différent de `event_admins` qui est par-event) :
```sql
create table public.platform_admins (
  user_id uuid primary key,
  email text not null,
  created_at timestamptz not null default now()
);
-- INSERT manuel de ton user_id après ton premier signup
```

### RLS
- `event_coupons` : SELECT/INSERT/UPDATE/DELETE réservés aux `platform_admins` via `is_platform_admin(auth.uid())`
- `event_coupon_redemptions` : INSERT via RPC seulement, SELECT pour platform_admins
- **Validation coupon publique** via RPC `validate_coupon(_code text)` SECURITY DEFINER qui retourne juste `{ valid: boolean, reason?: string }` sans exposer la table

### RPC `create_event_with_coupon`
SECURITY DEFINER qui dans une transaction :
1. Vérifie le coupon (actif, pas expiré, uses < max_uses)
2. Vérifie unicité slug + code_acces
3. Insère l'event
4. Insère `event_admins` (organisateur = auth.uid() / email)
5. Insère `event_coupon_redemptions`
6. Incrémente `uses_count`
7. Retourne `{ event_id, slug, code_acces }`

Évite tout risque de race condition / coupon réutilisé en parallèle.

### Page admin coupons (pour toi) `/platform/coupons`
Route protégée par `is_platform_admin`. UI simple :
- Liste des coupons (code, type, uses/max, expire, actif)
- Bouton "Créer un coupon" → form (code custom ou auto-généré, max_uses, expires_at)
- Bouton désactiver / supprimer

---

## 4. Page `/create-event/success`

Affiche après création :
- ✓ "Votre event est prêt"
- QR code (canvas via `qrcode`, comme `QrPanel`) pointant vers `https://kapsul.events/e/{slug}`
- Lien copiable + code d'accès en grand
- 2 boutons : **Ouvrir le tableau de bord** (`/$slug/admin/dashboard`) et **Voir la galerie** (`/e/$slug`)

---

## 5. Migration de la galerie actuelle vers `/e/$slug`

- Créer `src/routes/e.$slug.tsx` qui contient le code actuel de `src/routes/index.tsx`, mais lit le slug depuis l'URL au lieu du `EVENT_SLUG = "JULIE2026"` hardcodé.
- L'`AccessGate` actuel reste pour gérer le code d'accès invité.
- Mettre à jour `QrPanel.tsx` : URL encodée = `https://kapsul.events/e/{slug}` (au lieu de `/?code=`).
- Sur `/`, gérer `?code=XXXX` : lookup event par code → redirect `/e/{slug}?code=XXXX` pour rétro-compat des anciens QR imprimés.

---

## 6. Sécurité (validation Zod côté client + DB côté serveur)

- Toutes les chaînes : trim + length min/max
- Email : format + max 255
- Date event : doit être dans le futur, max +5 ans
- Code coupon : `[A-Z0-9_-]{4,40}`
- Cover : type MIME whitelist + taille via R2 presigned URL existant
- Validation finale dans la RPC `create_event_with_coupon` (RAISE EXCEPTION si invalide)

---

## Détails techniques

**Fichiers créés** :
- `src/routes/index.tsx` (réécrit complètement — landing organisateur)
- `src/routes/create-event.tsx`
- `src/routes/create-event.success.tsx`
- `src/routes/e.$slug.tsx` (déplacement du code actuel de index)
- `src/routes/platform.coupons.tsx` (admin coupons super-admin)
- `src/lib/zest-create-event.ts` (helpers : slugify, generateCode, callRpc)

**Fichiers modifiés** :
- `src/components/zest/QrPanel.tsx` (URL → `/e/{slug}`)
- `src/components/zest/Footer.tsx` si nécessaire
- `src/integrations/supabase/types.ts` (auto-régénéré après migration)

**Migrations SQL** :
- Tables `event_coupons`, `event_coupon_redemptions`, `platform_admins`
- RLS policies
- Fonctions `is_platform_admin(_uid uuid)`, `validate_coupon(_code text)`, `create_event_with_coupon(...)`
- Permettre `events` et `event_admins` INSERT via RPC SECURITY DEFINER (actuellement aucune INSERT policy sur `events`)

**Email confirmation** :
- Flow Supabase standard, `emailRedirectTo: origin + "/create-event"`
- Pas besoin de toucher aux templates email — on garde les défauts Lovable Cloud
- Tu pourras activer des templates brandés plus tard si tu veux

**Après que tu approuves** :
1. Je crée les migrations SQL
2. Je te demanderai ton email pour t'insérer dans `platform_admins` (ou je te donne la requête SQL à coller)
3. J'écris les routes et composants
4. Je te livre l'URL de la page `/platform/coupons` pour que tu génères ton premier coupon