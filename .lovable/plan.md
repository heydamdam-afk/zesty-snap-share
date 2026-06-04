Modifier `src/routes/api/bug-report.ts` pour envoyer le rapport de bug à deux destinataires : `debbito@gmail.com` et `damien@baruuu.fr`.

## Changements

1. Remplacer la constante `TO` (string) par `RECIPIENTS` (array) :
   ```ts
   const RECIPIENTS = ["debbito@gmail.com", "damien@baruuu.fr"];
   ```

2. Boucler sur les destinataires lors de l'envoi :
   - Pour chaque destinataire, garantir un `unsubscribe_token` dans `email_unsubscribe_tokens` (réutiliser la logique existante, par destinataire).
   - Appeler `sendLovableEmail` une fois par destinataire avec un `idempotency_key` distinct (`bug-report-${ticketId}-${recipient}`).
   - `reply_to` reste l'email du contact qui a soumis le bug.

3. Gestion d'erreur :
   - Si **au moins un** envoi réussit → marquer le ticket `email_sent: true` et renvoyer `200 ok`.
   - Si **tous** échouent → `email_sent: false`, stocker les erreurs concaténées dans `email_error`, renvoyer `502`.
   - Logger succès/échec par destinataire.

4. Aucun changement frontend, aucun changement de schéma DB.

## Vérification

- Tester `POST /api/bug-report` via `stack_modern--invoke-server-function` après publication.
- Vérifier les logs serveur : deux envois acceptés.
- Vérifier `email_send_log` pour deux lignes `sent` (une par destinataire).
