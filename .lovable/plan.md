## Diagnostic

Le domaine d’envoi `notify.kapsul.events` est bien vérifié. Les logs montrent que la route `/api/bug-report` échoue encore avec :

```text
Email API error: 400 missing_parameter: text
```

Le fichier actuel contient bien un champ `text`, donc le problème vient très probablement du déploiement live qui utilise encore une ancienne version du code, ou d’un appel SDK dont la forme n’est pas celle réellement attendue par l’API email en production.

## Plan de correction

1. **Sécuriser l’appel email**
   - Remplacer l’appel direct fragile à `sendLovableEmail(...)` par un payload explicite conforme à l’API email attendue.
   - Garantir que `text` est toujours une chaîne non vide, même si certaines données optionnelles sont absentes.
   - Conserver `html`, `subject`, `reply_to`, `purpose`, `label` et `idempotency_key`.

2. **Améliorer le diagnostic côté serveur**
   - Ajouter un log serveur minimal avant envoi indiquant uniquement les champs présents (`hasText`, `hasHtml`, domaine, sujet), sans exposer de données sensibles.
   - Garder le message utilisateur inchangé côté formulaire.

3. **Vérifier l’endpoint après correction**
   - Tester `/api/bug-report` avec un payload sans image et sans téléphone, comme votre cas.
   - Vérifier que la route ne renvoie plus `502`.
   - Reconsulter les logs serveur pour confirmer qu’il n’y a plus d’erreur `missing_parameter: text`.

4. **Si nécessaire : synchronisation live**
   - Si la preview fonctionne mais pas `app.kapsul.events`, publier la version corrigée pour que le domaine live utilise bien le nouveau code.