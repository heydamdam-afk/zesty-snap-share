# Fix création d'event : bug FK + reset coupon

## Diagnostic

L'erreur 409 vient d'un bug dans la définition de la table `event_admins` :

- La contrainte `event_admins_added_by_fkey` référence `event_admins(id)` au lieu de `auth.users(id)`.
- La fonction `create_event_with_coupon` insère `added_by = _user_id` (un UUID `auth.users`), ce qui viole la FK → erreur Postgres 23503 → renvoyée en HTTP 409.

Conséquence : impossible de créer un event tant que la FK n'est pas corrigée.

Et bonus : le coupon `DBRETEAU-FREE` affiche `uses_count=4` alors qu'aucune redemption n'a été enregistrée — il faut le remettre à zéro pour que vous puissiez réessayer.

## Ce que je vais faire

1. **Migration SQL** :
   - Drop la contrainte FK incorrecte `event_admins_added_by_fkey`.
   - Recréer correctement : `added_by REFERENCES auth.users(id) ON DELETE SET NULL`.
   - Reset du coupon `DBRETEAU-FREE` : `uses_count = 0`, `max_uses = 5` (pour vous laisser une marge si erreur).

2. **Aucun changement frontend** nécessaire — la logique côté React est correcte.

## Réponse à votre question

> "je n'ai rien à publier avant de refaire un test ?"

**Non, rien à publier.** Vous testez sur le **preview** (`id-preview--…lovable.app`), donc dès que la migration est appliquée vous pouvez retenter immédiatement la création d'event sans publier. La publication ne sert qu'à mettre à jour le site live `kapsul.events`.

## Détails techniques

```sql
ALTER TABLE public.event_admins
  DROP CONSTRAINT event_admins_added_by_fkey;

ALTER TABLE public.event_admins
  ADD CONSTRAINT event_admins_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.event_coupons
  SET uses_count = 0, max_uses = 5
  WHERE code = 'DBRETEAU-FREE';
```

Après application : retournez sur `/create-event`, saisissez `DBRETEAU-FREE`, créez votre event — ça doit passer.
