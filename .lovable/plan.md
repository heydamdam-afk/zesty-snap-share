Je vais corriger le blocage de connexion lié à une ancienne session locale invalide après le changement d'email.

Plan :
1. Sur la page de connexion, remplacer la vérification automatique basée sur la session locale par une vérification utilisateur réellement valide.
2. Si l'ancienne session est refusée par le backend, la nettoyer localement au lieu de rediriger automatiquement vers `/my-events`.
3. Dans la protection de `/my-events`, nettoyer aussi les sessions invalides avant de renvoyer vers `/login`, pour éviter la boucle login → my-events → login.
4. Garder le comportement actuel après une vraie connexion réussie : liaison des événements, puis redirection vers `/my-events` ou vers le `redirect` demandé.
5. Ajuster le message d'erreur de connexion pour afficher une erreur claire si les identifiants sont incorrects, sans rester bloqué sur le bouton `…`.