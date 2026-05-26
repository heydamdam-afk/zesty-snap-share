## Cause identifiée

Dans `src/routes/lovable/email/auth/webhook.ts`, les constantes de domaine ne correspondent pas au domaine email réellement vérifié :

| Constante (code actuel) | Valeur réelle vérifiée |
|---|---|
| `SENDER_DOMAIN = "notify.app.kapsul.events"` | `notify.kapsul.events` ✅ vérifié |
| `ROOT_DOMAIN = "app.kapsul.events"` | `kapsul.events` |
| `FROM_DOMAIN = "app.kapsul.events"` | `kapsul.events` |

Le `SENDER_DOMAIN` envoyé à l'API Lovable Email **doit être exactement le FQDN du sous-domaine vérifié**. Avec `notify.app.kapsul.events`, aucun enregistrement de domaine n'existe côté API → l'envoi est rejeté silencieusement et l'email n'arrive jamais en boîte.

Les logs `email_send_log` confirment qu'aucun email n'a été enqueué dans les dernières 24h pour les tests récents (les "sent" plus anciens datent d'avant un changement de config). Les flux UI (signup, recovery) marchent — c'est bien l'étape d'envoi côté webhook qui échoue.

## Plan

1. **Modifier `src/routes/lovable/email/auth/webhook.ts`** — corriger les 3 constantes :
   ```ts
   const SENDER_DOMAIN = "notify.kapsul.events"
   const ROOT_DOMAIN   = "kapsul.events"
   const FROM_DOMAIN   = "kapsul.events"
   ```
   (Aucun autre changement de logique. Les templates et la signature webhook restent identiques.)

2. **Vérification après publication** :
   - Déclencher un "mot de passe oublié" sur un compte connu
   - Vérifier que `email_send_log` enregistre une ligne `pending` puis `sent` pour `recovery`
   - Vérifier réception en boîte mail

Si après ce fix les emails passent en `sent` mais n'arrivent toujours pas, on ira inspecter Cloud → Emails (état de delivery côté provider) et `suppressed_emails`.

## Notes techniques

- Le domaine racine du projet (publié sur `app.kapsul.events`) n'a pas d'impact sur `SENDER_DOMAIN` — seul le sous-domaine `notify.*` réellement délégué aux NS Lovable compte pour l'envoi.
- `FROM_DOMAIN` détermine l'adresse `From:` affichée. La passer à `kapsul.events` donne `noreply@kapsul.events`, ce qui est cohérent avec la marque.
