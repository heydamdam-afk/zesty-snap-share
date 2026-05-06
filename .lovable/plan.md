## Diagnostic vérifié

J'ai testé l'endpoint R2 du bucket `kapsul-photos` directement :

```text
OPTIONS https://bd310039246486aaa18fb9a940da23c9.r2.cloudflarestorage.com/kapsul-photos/test.txt
→ 403 Forbidden
   <Code>Unauthorized</Code>
   <Message>CORS not configured for this bucket</Message>
```

Conclusion : **la CORS policy n'est pas appliquée sur le bucket `kapsul-photos`**. Le serveur R2 lui-même répond qu'il n'y a pas de configuration CORS — donc le préflight échoue et le navigateur bloque le PUT (`status: 0`).

## Pourquoi ne pas signer contre `pub-...r2.dev`

R2 impose ces règles :

- `*.r2.dev` et les custom domains type `photos.kapsul.events` sont **lecture seule** (GET/HEAD uniquement).
- Les opérations d'écriture (PUT/DELETE) DOIVENT passer par l'endpoint S3 `<accountId>.r2.cloudflarestorage.com`.
- Les URLs présignées SigV4 incluent le `host` dans la signature : on ne peut pas signer pour un host puis appeler un autre.

Donc remplacer le host d'upload par `pub-...r2.dev` produira un 403 systématique côté R2, indépendamment de la CORS. Ce n'est pas la bonne piste.

## Vraie correction requise

La CORS policy doit être posée sur le bucket `kapsul-photos` côté Cloudflare R2. À faire dans le dashboard Cloudflare → R2 → bucket `kapsul-photos` → Settings → CORS Policy :

```json
[
  {
    "AllowedOrigins": [
      "https://4daa509d-17a4-4a16-b776-872270e66045.lovableproject.com",
      "https://id-preview--4daa509d-17a4-4a16-b776-872270e66045.lovable.app",
      "https://zesty-snap-share.lovable.app",
      "https://kapsul.events",
      "https://www.kapsul.events"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Important : le bucket à configurer est `kapsul-photos`. Les éventuelles policies posées précédemment sur `kapsul` ou un autre bucket ne s'appliquent pas ici.

## Plan d'implémentation côté code

Une fois la CORS posée sur le bon bucket, le code actuel fonctionnera. Je propose deux ajustements quand même :

1. `src/server/r2.server.ts` — exporter le bucket et l'account ID via une petite fonction `getR2DiagInfo()` pour que `createR2UploadUrl` retourne dans sa réponse :
   - `uploadHost` (host S3 utilisé pour le PUT)
   - `bucket`
   - sans secrets ni signature
   afin de confirmer côté navigateur quel bucket est ciblé.

2. `src/lib/zest-actions.ts` — quand `xhr.status === 0`, faire un second appel `OPTIONS` rapide vers le même `uploadUrl` (sans signature) pour lire le code et le body R2 ; si la réponse contient `CORS not configured for this bucket`, afficher un message explicite :

   > La CORS policy du bucket R2 `<bucket>` n'est pas configurée. Ajoute-la sur Cloudflare → R2 → `<bucket>` → Settings → CORS Policy.

Je n'effectue **aucune modification d'endpoint d'upload** : on reste sur `r2.cloudflarestorage.com` qui est le seul host valide pour signer un PUT R2.

## Étapes

1. Mettre à jour `src/server/r2.server.ts` pour exposer `getR2DiagInfo()` + inclure le bucket dans la réponse signée.
2. Mettre à jour `src/server/r2.functions.ts` pour renvoyer `uploadHost` et `bucket` au navigateur.
3. Mettre à jour `src/lib/zest-actions.ts` `putToR2` pour pinger l'OPTIONS et différencier "CORS non configurée" vs "autre erreur réseau", avec un message d'erreur précis.
4. Demander à l'utilisateur de poser la policy CORS ci-dessus sur le bucket `kapsul-photos`.