## Plan de correction

1. **Supprimer le déclenchement automatique à 0 €**
   - Retirer le rendu spécial qui remplace l’écran par un spinner quand `finalCents === 0`.
   - Garder l’écran checkout visible même si le coupon rend le total gratuit.
   - Le paiement/création ne démarrera qu’au clic sur le bouton d’action.

2. **Mettre à jour le bouton selon la réduction**
   - Afficher le prix final directement dans le bouton, par exemple :
     - `Payer 29 €`
     - `Payer 19 €` si remise en montant ou pourcentage
     - `Créer gratuitement` si le coupon met le prix à 0 €
   - Conserver le prix barré dans le récapitulatif quand une réduction s’applique.

3. **Stabiliser l’état du coupon**
   - Empêcher qu’un code en cours de validation déclenche une action implicite.
   - Désactiver le bouton pendant la validation du coupon pour éviter de payer avec un état intermédiaire.
   - Conserver la validation automatique du champ coupon uniquement pour l’affichage du prix, pas pour lancer le paiement.

4. **Flux au clic uniquement**
   - Au clic :
     - si total > 0, création de la session Stripe Embedded Checkout puis affichage du formulaire Stripe ;
     - si total = 0, création immédiate de l’événement via le flux gratuit existant.
   - Ne pas modifier le tunnel Stripe côté serveur ni les coupons en base.