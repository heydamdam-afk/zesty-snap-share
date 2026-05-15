## Diagnostic

Le backend est disponible, la colonne `frozen_at` existe, la valeur `frozen` est bien autorisée par la contrainte de statut, et aucun trigger ne bloque la table `events`.

La cause probable est claire : la table `events` n’a actuellement qu’une règle de lecture publique. Il n’existe aucune règle autorisant un administrateur authentifié à modifier un événement. Donc l’appel frontend :

```ts
supabase.from('events').update(...).eq('id', event.id)
```

peut être bloqué par les règles d’accès de la base. Résultat : pas de passage à `status = 'frozen'`, pas de `frozen_at = now`, et le webhook n8n ne devrait pas être déclenché si l’erreur est correctement gérée.

## Plan de résolution recommandé

1. Ajouter une règle d’accès backend sur `events`
   - Autoriser uniquement les administrateurs de l’événement à modifier la ligne correspondante.
   - Utiliser la fonction existante `is_event_admin_email(id)` ou équivalent déjà en place.
   - Ne pas ouvrir la modification aux invités ni au public.

2. Limiter la règle au strict besoin
   - La règle doit permettre à l’admin de mettre à jour l’événement dont il est admin.
   - Elle servira à la clôture, mais aussi potentiellement aux réglages admin déjà existants si ceux-ci modifient `events` depuis le client.

3. Tester le flux
   - Cliquer sur `Clôturer l'événement`.
   - Confirmer dans la popup.
   - Vérifier que `events.status` devient `frozen`.
   - Vérifier que `events.frozen_at` reçoit une date immédiate.
   - Vérifier que `uploads_actifs`, `commentaires_actifs`, `likes_actifs` passent à `false`.

## Alternative plus robuste

Au lieu de laisser le frontend modifier directement `events`, on peut déplacer la clôture dans une fonction serveur Lovable :

- le bouton appelle une fonction serveur `freezeEvent` ;
- la fonction vérifie côté serveur que l’utilisateur est bien admin de l’événement ;
- elle met à jour `status`, `frozen_at` et les flags ;
- puis le frontend déclenche le webhook n8n en arrière-plan, ou la fonction serveur le déclenche elle-même.

C’est plus robuste, mais c’est une modification un peu plus large. Pour corriger le bug actuel avec le minimum de changement, la règle d’accès `UPDATE` sur `events` est la solution la plus directe.