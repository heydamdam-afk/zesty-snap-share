# Vérification du flow "utilisateur non confirmé"

Objectif : confirmer que lorsqu'un compte existe dans `auth.users` avec `email_confirmed_at = null`, la landing page affiche bien le message "première fois" + le bouton "Renvoyer l'email de confirmation".

## 1. Préparer un utilisateur de test non confirmé

Créer (ou réutiliser) un compte dans Lovable Cloud avec :
- email : `test-unconfirmed+{timestamp}@kapsul.events`
- mot de passe défini
- `email_confirmed_at = NULL`
- `confirmation_sent_at` rempli (signup envoyé)

Méthode : insérer via l'API admin Supabase (un seul appel serveur), pas via le formulaire (sinon auto-confirm pourrait interférer).

## 2. Vérifier le comportement UI sur `/`

Étapes simulées dans le navigateur (preview) :
1. Aller sur `/`, rester en mode "Se connecter"
2. Saisir l'email du compte non confirmé + le mot de passe
3. Cliquer "Se connecter"

Attendu :
- Pas de redirection vers `/my-events`
- Le bandeau vert "Bienvenue ! Votre compte a bien été créé, mais votre email n'est pas encore confirmé…" s'affiche
- Le bouton **"Renvoyer l'email de confirmation"** est visible sous le message
- Le state `unconfirmed` est à `true` (validé via le rendu du bouton)

## 3. Vérifier le renvoi d'email

1. Cliquer "Renvoyer l'email de confirmation"
2. Attendu UI : le bouton passe à "Envoi…" puis message "Email de confirmation renvoyé…"
3. Vérification backend :
   - Une nouvelle ligne `type = 'signup'` (ou `confirmation`) apparaît dans `email_send_log` avec `status` passant de `pending` à `sent`
   - `auth.users.confirmation_sent_at` est mis à jour

## 4. Cas négatif (sanity check)

Refaire le même flow avec un compte **confirmé** :
- Le bandeau "première fois" NE doit PAS s'afficher
- L'utilisateur est redirigé vers `/my-events`

## 5. Nettoyage

Supprimer le compte de test créé à l'étape 1 (`auth.admin.deleteUser`).

## Détails techniques

- Création du compte non confirmé : appel `supabase.auth.admin.createUser({ email, password, email_confirm: false })` via `supabaseAdmin` dans un script `code--exec` ponctuel (pas de nouvelle route).
- Vérification UI : `browser--act` + `browser--read_console_logs` sur la preview `/`.
- Vérification email_send_log : `supabase--read_query` filtré sur l'email de test, ordre `created_at DESC`.
- Le code de `src/routes/index.tsx` détecte déjà `err.code === "email_not_confirmed"` — aucune modification de code prévue, c'est une phase de **test/validation** uniquement.

Aucun fichier ne sera modifié sauf si le test révèle un bug (auquel cas un nouveau plan sera proposé).
