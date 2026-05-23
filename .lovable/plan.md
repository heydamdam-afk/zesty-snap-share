## Problème

Sur navigation vers `/create-event/checkout`, la page checkout ne s'affiche pas — on reste visuellement sur le formulaire.

**Cause** : en routing flat de TanStack Router, `create-event.tsx` + `create-event.checkout.tsx` créent une hiérarchie parent/enfant. Le parent (`create-event.tsx`) rend `CreateEventPage` mais **ne contient pas `<Outlet />`**, donc la route enfant matche mais n'a aucun point de rendu. Même problème pour `/create-event/success`.

## Correction

Convertir `create-event` en groupe de routes sœurs sans layout partagé :

1. Renommer `src/routes/create-event.tsx` → `src/routes/create-event.index.tsx`
   - Aucune modification de contenu nécessaire ; le `createFileRoute('/create-event')` reste valide (les fichiers `*.index.tsx` mappent sur le path du parent).

Résultat : `/create-event`, `/create-event/checkout`, `/create-event/success` deviennent trois routes indépendantes, plus de layout parent fantôme. La navigation depuis le bouton "Continuer vers le paiement" affichera bien la page checkout (qui lira `kapsul_pending_form` depuis sessionStorage comme prévu).

Aucune autre modification nécessaire — le `routeTree.gen.ts` se régénère automatiquement.
