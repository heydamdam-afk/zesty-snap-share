Diagnostic confirmé côté serveur:
- Le service email réellement appelé est Lovable Emails via `@lovable.dev/email-js`, pas Brevo.
- Le domaine email configuré et vérifié est `notify.kapsul.events`.
- C’est pour ça que le `from` actuel est `bugs@notify.kapsul.events`: avec Lovable Emails, l’envoi passe par le sous-domaine email délégué et vérifié. `bugs@kapsul.events` ne peut être utilisé en From visible que si la configuration Lovable Emails permet l’affichage depuis le domaine racine; sinon le From doit rester sur le sous-domaine vérifié.
- L’erreur publiée actuelle est toujours: `missing_unsubscribe` / “Transactional emails must include an unsubscribe_token”. Donc la requête envoyée au service email ne contient toujours pas le champ attendu au bon endroit/format, malgré le code local qui le prévoit.

Plan backend uniquement:
1. Modifier uniquement `src/routes/api/bug-report.ts`.
2. Remplacer l’appel direct bas niveau à `sendLovableEmail` par le chemin Lovable Emails standard déjà prévu pour les emails applicatifs, afin que l’unsubscribe token soit géré correctement par l’infrastructure email.
3. Garder l’expéditeur compatible avec le domaine vérifié `notify.kapsul.events` pour garantir la délivrabilité; ne pas passer en `bugs@kapsul.events` tant que la config email ne confirme pas que le From racine est autorisé.
4. Ajouter des logs serveur utiles mais sûrs: domaine expéditeur, présence de token, message id / statut de succès, sans exposer de secret.
5. Tester moi-même un POST complet sur `/api/bug-report` après correction.
6. Vérifier les logs serveur et ne considérer la correction terminée que si le log montre un envoi accepté avec succès.