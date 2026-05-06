## Problème confirmé

Le bucket `kapsul-photos` est dans la **juridiction EU** de R2 (Wrangler n'a accepté la commande qu'avec `--jurisdiction eu`).

Ces buckets ne sont PAS accessibles via l'endpoint global `https://{accountId}.r2.cloudflarestorage.com`. Ils ne sont accessibles que via le sous-domaine régional :

```
https://{accountId}.eu.r2.cloudflarestorage.com
```

Test direct effectué à l'instant sur l'endpoint global → R2 répond `403 CORS not configured`, indépendamment de la policy posée. Le navigateur tape donc un host qui ignore la config CORS du bucket EU.

C'est pour ça qu'on tournait en rond : la policy CORS est correctement posée, mais sur le bon bucket à la mauvaise adresse.

## Changement

Un seul fichier touché : `src/server/r2.server.ts`.

Modifier `getR2Endpoint()` pour insérer `.eu.` dans le host :

```ts
export function getR2Endpoint(): string {
  const accountId = env("R2_ACCOUNT_ID");
  const bucket = env("R2_BUCKET_NAME");
  return `https://${accountId}.eu.r2.cloudflarestorage.com/${bucket}`;
}
```

Et mettre à jour `getR2DiagInfo()` en miroir pour que les logs côté client affichent le bon host :

```ts
export function getR2DiagInfo(): { uploadHost: string; bucket: string } {
  const accountId = env("R2_ACCOUNT_ID");
  const bucket = env("R2_BUCKET_NAME");
  return {
    uploadHost: `${accountId}.eu.r2.cloudflarestorage.com`,
    bucket,
  };
}
```

Aucun autre fichier à toucher :
- `signPutUrl`, `deleteR2Key` consomment `getR2Endpoint()` → propagé automatiquement.
- `publicUrlFor` / `keyFromPublicUrl` utilisent `https://photos.kapsul.events` → indépendant.
- Les variables d'env (`R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, clés) sont inchangées.

## Vérification après build

1. Re-tester un upload depuis `/e/evj-gregoire` → la requête PUT doit partir vers `…eu.r2.cloudflarestorage.com/...`.
2. Si la signature reste valide (la région `auto` couvre EU) et la CORS policy déjà posée, l'upload doit passer en 200.
3. Si on récupère `SignatureDoesNotMatch` au lieu de l'erreur CORS, on saura que le hop suivant est juste un ajustement région — mais aws4fetch avec `region: "auto"` gère normalement le cas.

## Risque

Très faible. Si l'endpoint EU n'était pas le bon (peu probable vu que Wrangler exige `--jurisdiction eu`), on retombera sur une 4xx claire avec un message R2 explicite, et on ajustera. Aucune donnée existante n'est impactée — les anciennes URLs publiques `photos.kapsul.events/...` continuent de servir via le custom domain.