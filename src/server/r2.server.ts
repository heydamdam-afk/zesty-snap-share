import { AwsClient } from "aws4fetch";

const PUBLIC_BASE = "https://photos.kapsul.events";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getR2Client() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

export function getR2Endpoint(): string {
  const endpoint = env("R2_ENDPOINT").trim().replace(/\/+$/, "");
  const bucket = env("R2_BUCKET_NAME");
  return `${endpoint}/${bucket}`;
}

/**
 * Diagnostic info safe to expose to the browser (no secrets / no signature).
 * Lets the client log exactly which bucket / host the signed PUT is targeting.
 */
export function getR2DiagInfo(): { uploadHost: string; bucket: string } {
  const endpoint = env("R2_ENDPOINT").trim().replace(/\/+$/, "");
  const bucket = env("R2_BUCKET_NAME");
  return {
    uploadHost: new URL(endpoint).host,
    bucket,
  };
}

export function publicUrlFor(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
}

/** Extract the R2 object key from a stored public URL. */
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null;
  // Strip query string first.
  const noQuery = url.split("?")[0];
  const prefix = `${PUBLIC_BASE}/`;
  if (noQuery.startsWith(prefix)) return noQuery.slice(prefix.length);
  // Fallback: also handle the r2.dev URL just in case.
  const m = noQuery.match(/^https?:\/\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

export function buildPhotoKey(eventId: string, ext: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeExt = (ext || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${eventId}/${ts}-${rand}.${safeExt}`;
}

/** Sign a PUT URL valid for ~5 minutes. */
export async function signPutUrl(key: string, contentType: string): Promise<string> {
  const client = getR2Client();
  const url = `${getR2Endpoint()}/${key}?X-Amz-Expires=300`;
  const signed = await client.sign(
    new Request(url, { method: "PUT", headers: { "content-type": contentType } }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export async function deleteR2Key(key: string): Promise<void> {
  const client = getR2Client();
  const url = `${getR2Endpoint()}/${key}`;
  const res = await client.fetch(url, { method: "DELETE" });
  // R2 returns 204 on success, also 404 if missing — treat both as ok.
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 delete failed: ${res.status} ${text}`);
  }
}

/**
 * Upload a file body directly to R2 from the server (no presigned URL).
 * Used by the /api/public/r2-upload proxy so the browser never talks to R2.
 */
export async function putR2Object(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const client = getR2Client();
  const url = `${getR2Endpoint()}/${key}`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 put failed: ${res.status} ${text.slice(0, 300)}`);
  }
}