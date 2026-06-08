# Profil unique Kapsul — propagation partout

## Principe
`profiles.avatar_url` et `profiles.avatar_name` deviennent la **seule source de vérité** pour tout utilisateur authentifié (organisateur ou admin secondaire), partout où l'app affiche son identité visuelle. Aucune duplication, aucun stockage dans `event_admins` ou `commentaires`. Les invités sans compte (device_id pur) ne sont pas touchés.

## 1. Backend — accès public en lecture aux profils (1 migration)

Aujourd'hui la table `profiles` n'autorise la lecture qu'à `auth.uid() = id`. Impossible donc d'afficher l'avatar d'un *autre* admin / commentateur. On expose **uniquement les champs publics** via une RPC SECURITY DEFINER, par email :

```sql
create or replace function public.get_profiles_by_emails(_emails text[])
returns table(email text, avatar_url text, avatar_name text, prenom text, nom text)
language sql stable security definer set search_path = public
as $$
  select lower(p.email), p.avatar_url, p.avatar_name, p.prenom, p.nom
  from public.profiles p
  where lower(p.email) = any(select lower(unnest(_emails)));
$$;
grant execute on function public.get_profiles_by_emails(text[]) to authenticated, anon;
```

Les colonnes sensibles (`telephone`, `date_naissance`) restent inaccessibles.

## 2. État global — `SessionProvider`

Ajout d'un champ `profile` au contexte :
- chargé automatiquement quand `user` est défini (lecture de la ligne `profiles` pour `user.id`),
- exposé via `useSession()`,
- `setProfile()` exposé pour mise à jour optimiste depuis la modale.

Tous les composants qui consomment `session.profile` se re-rendent immédiatement après sauvegarde.

## 3. Modale Profil

`ProfileModal.handleSaveProfile` appelle `session.setProfile({ avatar_url, avatar_name, prenom, nom })` après le `update`. La propagation est instantanée, sans rechargement.

L'upload d'avatar appelle aussi `setProfile` avec la nouvelle URL.

## 4. Header `/my-events`

Le header lit `session.profile.avatar_url` et `session.profile.avatar_name` (au lieu de l'état local actuel). Plus besoin du `onAvatarChange` qui pousse vers un state local : la propagation passe par le contexte.

## 5. Feed event — `useEventFeed` + `PostCard`

`useEventFeed` :
- récupère les emails des invites des posts/commentaires (via `invites.email`),
- appelle `get_profiles_by_emails` une fois,
- expose une `Map<emailLower, profileOverlay>`.

`PostCard` reçoit cette map. Pour chaque post/commentaire :
- si `invite.email` matche un profil → on affiche `profile.avatar_url` et `profile.avatar_name` à la place de `invite.avatar_url` / `invite.prenom`,
- sinon → fallback actuel (invite ou initiales).

Aucun changement dans la table `commentaires`. Aucune migration sur posts. Les anciens commentaires d'un user authentifié afficheront automatiquement son **avatar_name actuel**, conformément au prompt.

## 6. Panel admin

**`AdminsSection`** : après le `select` sur `event_admins`, on appelle `get_profiles_by_emails` avec les emails de la liste. On affiche :
- un `<Avatar>` (cercle coral + initiales fallback) à gauche de chaque ligne,
- le `avatar_name` du profil si disponible, sinon `prenom`, sinon `email.split("@")[0]`.

**`AdminHeader`** : affiche l'avatar + nom de l'utilisateur courant via `session.profile` (à droite du badge de rôle).

## 7. ProfileMenu (pop-over de l'invité)

Détection : si `guest.invite.email` correspond à un compte Supabase Auth (présent dans `get_profiles_by_emails`), on **masque l'entrée « Mon profil »** dans le menu. La gestion se fait alors uniquement depuis `/my-events`. L'avatar affiché en haut à droite utilise `profile.avatar_url` si disponible.

## 8. Ce qui ne bouge PAS
- Schéma des tables existantes (les colonnes `event_admins.avatar_url` / `event_admins.prenom` restent en place mais ne sont plus lues pour l'affichage).
- Logique device_id des invités sans compte.
- Tables `commentaires` / `posts` / `invites` (aucune migration).
- `ProfileDialog` (modale invité device_id).

## Fichiers touchés (estimation)
- `supabase/migrations/<ts>_get_profiles_by_emails.sql` (nouveau)
- `src/contexts/SessionProvider.tsx`
- `src/components/zest/ProfileModal.tsx`
- `src/routes/my-events.tsx`
- `src/hooks/useEventFeed.ts`
- `src/components/zest/PostCard.tsx`
- `src/components/zest/admin/AdminsSection.tsx`
- `src/components/zest/admin/AdminHeader.tsx`
- `src/components/zest/ProfileMenu.tsx`
- `src/integrations/supabase/types.ts` (regénéré auto après migration)
