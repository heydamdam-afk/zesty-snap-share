## Diagnostic

Le domaine email est bien vérifié : `notify.kapsul.events` est actif.

Les logs d’envoi montrent que les emails `magiclink` et `recovery` partent bien (`pending` puis `sent`), mais il n’existe aucun email de type `signup` dans `email_send_log`.

Côté base, les comptes récents ont `email_confirmed_at` rempli immédiatement et `confirmation_sent_at = null`. Cela indique que la validation email est actuellement contournée/auto-confirmée pour les créations de compte : aucun email de confirmation n’est généré, donc rien ne peut arriver en boîte mail.

Pour les collaborateurs ajoutés depuis l’admin, le code ajoute seulement une ligne dans `event_admins`. Il n’appelle aucun flux d’invitation/validation email ; le texte indique simplement que la personne pourra se connecter via un lien, mais aucun email n’est envoyé à ce moment-là.

## Plan de correction

1. Désactiver l’auto-confirmation des nouveaux comptes
   - Configurer l’authentification pour que les nouvelles inscriptions nécessitent bien une confirmation email.
   - Conserver l’inscription email/password active.
   - Ne pas activer d’inscriptions anonymes.

2. Corriger le flux “nouveau compte organisateur”
   - Garder l’appel `signUp` existant sur la landing page.
   - Après désactivation de l’auto-confirmation, ce flux déclenchera un email `signup` au lieu de confirmer immédiatement l’utilisateur.
   - Vérifier que le redirect après validation pointe vers le bon écran.

3. Corriger le flux “nouveau collaborateur”
   - Au moment où un organisateur ajoute un admin secondaire, déclencher explicitement un email de connexion/activation vers cet email.
   - Utiliser le flux d’auth existant qui génère déjà des emails `magiclink`, car il est confirmé comme fonctionnel dans les logs.
   - Rediriger le collaborateur vers le dashboard de l’événement après clic dans l’email.

4. Vérifier après implémentation
   - Créer un compte test et vérifier qu’une ligne `signup` apparaît dans `email_send_log` avec `pending` puis `sent`.
   - Ajouter un collaborateur test et vérifier qu’une ligne `magiclink` apparaît avec `pending` puis `sent`.
   - Confirmer qu’il n’y a pas d’entrée en suppression email pour le destinataire.