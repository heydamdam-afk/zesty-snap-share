## Contexte

Actuellement, le trigger `cascade_delete_archived_event` supprime aussi les lignes de `event_admins` quand un event passe en `archived`. Or les admins sont des utilisateurs inscrits sur l'app — leur compte (auth.users) reste, mais on ne veut pas non plus toucher à `event_admins` lors de la suppression d'un event.

Question : retirer `event_admins` de la cascade signifie que ces lignes vont rester orphelines (l'event sera supprimé mais pas le lien). Comme `event_admins.event_id` n'a pas de FK stricte, ça ne bloquera pas la suppression de l'event, mais il restera des lignes pointant vers un event inexistant.

## Plan

Modifier la fonction `cascade_delete_archived_event` pour **retirer la ligne** `DELETE FROM public.event_admins WHERE event_id = NEW.id;`.

Nouvel ordre de cascade :
1. `likes` (via posts)
2. `commentaires` (via posts)
3. `post_photos` (via posts)
4. `posts`
5. `event_bans`
6. `banned_invites`
7. `invites`
8. ~~`event_admins`~~ ← **supprimé de la cascade**
9. `events`

Les utilisateurs admin gardent leur compte (auth.users intact) et `my_admin_events()` ne retournera simplement plus cet event (puisque `events` est supprimé, le JOIN exclura la ligne orpheline de `event_admins`).

## Question

Veux-tu aussi que je **nettoie les lignes orphelines** de `event_admins` (celles dont l'event n'existe plus) ? Deux options :
- **A.** Laisser les lignes orphelines (simple, sans impact fonctionnel visible)
- **B.** Garder le `DELETE event_admins` dans la cascade (supprime juste le lien à cet event, pas le compte utilisateur) — c'est en fait ce que fait déjà le trigger actuel : on ne supprime PAS les comptes admin, juste leur rattachement à cet event archivé

Si ton intention était "ne pas supprimer les comptes utilisateurs des admins" : c'est **déjà le cas** — le trigger ne touche jamais à `auth.users`, il supprime juste la table de liaison `event_admins` pour cet event. Confirme-moi quelle interprétation est la bonne avant que j'applique la migration.