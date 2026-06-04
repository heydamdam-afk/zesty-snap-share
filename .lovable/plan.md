## 1. Retirer le bloc "Sévérité" du formulaire

**`src/components/bug-report/BugReportWidget.tsx`**
- Supprimer le `<Field label="Sévérité" required>` et la liste `SEVERITIES`.
- Supprimer l'état `severity` / `setSeverity` et le type `Severity`.
- Retirer `!!severity` de la condition `canSubmit`.
- Ne plus envoyer `severity` dans le `fetch("/api/bug-report")`.

**`src/routes/api/bug-report.ts`**
- Rendre `severity` optionnelle (defaut `"moyenne"`) dans `BodySchema` pour rester rétro-compatible si un ancien client envoie encore le champ, mais ne plus l'afficher dans l'email (supprimer la ligne `row("Sévérité", sevLabel)` du HTML et du texte). Conserver l'écriture en base dans `bug_tickets.severity` avec la valeur par défaut.

## 2. Stocker les captures et envoyer des liens

**Nouveau bucket Storage privé** `bug-screenshots` (migration via `supabase--storage_create_bucket`, public = false).

**`src/routes/api/bug-report.ts`** — après l'insert du ticket, avant l'envoi des emails :
- Pour chaque screenshot reçu (base64 dans `dataUrl`) :
  - Décoder le base64 en `Uint8Array`.
  - Uploader via `supabaseAdmin.storage.from("bug-screenshots").upload(path, bytes, { contentType })` avec `path = ${ticketId}/${i}-${safeName}`.
  - Générer une **signed URL** valable 30 jours via `createSignedUrl(path, 60*60*24*30)`.
- Remplacer dans le HTML email les `<img src="${dataUrl}">` par `<a href="${signedUrl}">${name}</a>` + une `<img src="${signedUrl}">` (les clients mail chargeront si l'utilisateur le permet).
- Garder une miniature inline n'est pas nécessaire : les liens suffisent.
- Logger en cas d'échec d'upload mais continuer (les autres captures et l'email partent quand même).

Aucune modification frontend nécessaire pour cette partie (le widget continue d'envoyer les `dataUrl` base64, le serveur fait la conversion).

## Vérification

- Soumettre un bug-report avec 2 captures.
- Vérifier : ticket en base sans champ sévérité affiché côté UI, fichiers présents dans `bug-screenshots/{ticketId}/`, email reçu avec liens cliquables.
