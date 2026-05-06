import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createR2UploadUrl } from "@/server/r2.functions";

export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const MAX_PHOTOS_PER_POST = 4;

export type UploadProgress = {
  index: number;
  total: number;
  fileName: string;
  status: "pending" | "uploading" | "done" | "error";
  percent: number;
  error?: string;
};

export async function findEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findEventByCode(code: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .ilike("code_acces", code.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findInvite(eventId: string, deviceId: string) {
  // device_id is no longer publicly readable. Use the SECURITY DEFINER RPC
  // which only returns the row when the caller proves their device_id.
  const { data, error } = await supabase.rpc("find_my_invite", {
    _event_id: eventId,
    _device_id: deviceId,
  });
  if (error) throw error;
  return (data as Tables<"invites"> | null) ?? null;
}

export async function loginToEvent(args: {
  slug: string;
  code: string;
  prenom: string;
  email?: string;
  rgpd: boolean;
  deviceId: string;
  avatarUrl?: string;
}) {
  // L'invité ne connaît que le code d'accès — on retrouve l'event par code.
  const event = await findEventByCode(args.code);
  if (!event) return { ok: false as const, reason: "bad_code" };

  // Vérifie si ce device est banni de cet event
  const { data: banned } = await supabase.rpc("is_device_banned", {
    _event_id: event.id,
    _device_id: args.deviceId,
  });
  if (banned) return { ok: false as const, reason: "banned" };

  const existing = await findInvite(event.id, args.deviceId);
  if (existing) return { ok: true as const, event, invite: existing };

  const prenomNorm = normalisePrenom(args.prenom);

  // Vérifie unicité du prénom dans cet event (insensible à la casse)
  const { data: clash } = await supabase
    .from("invites")
    .select("id")
    .eq("event_id", event.id)
    .ilike("prenom", prenomNorm)
    .maybeSingle();
  if (clash) return { ok: false as const, reason: "prenom_taken" as const };

  const { data, error } = await supabase
    .from("invites")
    .insert({
      event_id: event.id,
      prenom: prenomNorm,
      email: args.email?.trim().toLowerCase() || null,
      device_id: args.deviceId,
      avatar_url: args.avatarUrl ?? null,
      rgpd_consent: args.rgpd,
    })
    .select()
    .single();
  if (error) {
    // Course concurrente : la contrainte unique a sauté
    if (error.code === "23505") {
      return { ok: false as const, reason: "prenom_taken" as const };
    }
    return { ok: false as const, reason: "insert_failed", error };
  }
  return { ok: true as const, event, invite: data };
}

export function normalisePrenom(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase() + t.slice(1).toLocaleLowerCase();
}

/**
 * Génère jusqu'à `max` suggestions de prénom qui ne sont PAS dans `taken`
 * (comparaison insensible à la casse). `taken` peut contenir les prénoms
 * déjà utilisés dans l'event.
 */
export function generatePrenomSuggestions(
  prenom: string,
  taken: string[] = [],
  max = 3,
): string[] {
  const p = normalisePrenom(prenom);
  if (!p) return [];
  const takenLc = new Set(taken.map((t) => t.trim().toLocaleLowerCase()));
  const candidates: string[] = [];
  // Initiales A → Z
  for (let c = 65; c <= 90; c++) {
    candidates.push(`${p} ${String.fromCharCode(c)}.`);
  }
  // Variantes "bis", numériques
  candidates.push(`${p} bis`);
  for (let n = 2; n <= 9; n++) candidates.push(`${p} ${n}`);

  const out: string[] = [];
  for (const c of candidates) {
    if (takenLc.has(c.toLocaleLowerCase())) continue;
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Vérifie en temps réel si un prénom est disponible dans l'event identifié
 * par son code d'accès. Retourne les prénoms déjà pris (utile pour générer
 * des suggestions intelligentes) si clash.
 */
export async function checkPrenomAvailability(args: {
  code: string;
  prenom: string;
}): Promise<
  | { status: "no_event" }
  | { status: "empty" }
  | { status: "available"; eventId: string }
  | { status: "taken"; eventId: string; taken: string[] }
> {
  const prenom = args.prenom.trim();
  if (!prenom) return { status: "empty" };
  const event = await findEventByCode(args.code);
  if (!event) return { status: "no_event" };

  const norm = normalisePrenom(prenom);
  const { data: clash } = await supabase
    .from("invites")
    .select("id")
    .eq("event_id", event.id)
    .ilike("prenom", norm)
    .maybeSingle();

  if (!clash) return { status: "available", eventId: event.id };

  // Récupère tous les prénoms déjà pris (jusqu'à 200, largement suffisant)
  const { data: rows } = await supabase
    .from("invites")
    .select("prenom")
    .eq("event_id", event.id)
    .limit(200);
  const taken = (rows ?? []).map((r) => r.prenom).filter(Boolean) as string[];
  return { status: "taken", eventId: event.id, taken };
}

/**
 * Upload one file directly to Cloudflare R2 via a presigned PUT URL.
 * Reports progress via XHR.
 */
function putToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload R2 ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau"));
    xhr.send(file);
  });
}

export type UploadedPhoto = {
  urlMini: string;
  urlMedium: string;
  urlFull: string;
};

export async function uploadOnePhoto(
  file: File,
  eventId: string,
  onProgress?: (percent: number) => void,
): Promise<UploadedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(`Fichier trop volumineux (max 50 Mo) — ${file.name}`);
  }
  const type = (file.type || "image/jpeg").toLowerCase();
  if (!ACCEPTED_PHOTO_TYPES.includes(type)) {
    throw new Error(`Format non supporté — ${file.name}`);
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const signed = await createR2UploadUrl({
    data: { eventId, contentType: type, ext, size: file.size },
  });
  await putToR2(signed.uploadUrl, file, onProgress);
  return {
    urlMini: signed.urlMini,
    urlMedium: signed.urlMedium,
    urlFull: signed.urlFull,
  };
}

/**
 * Upload up to MAX_PHOTOS_PER_POST files in parallel (concurrency 5) and create
 * ONE `posts` row plus one `post_photos` row per uploaded file.
 */
export async function uploadPhotosBatch(args: {
  eventId: string;
  inviteId: string;
  files: File[];
  contenuTexte?: string;
  onProgress?: (p: UploadProgress) => void;
  concurrency?: number;
}): Promise<{ ok: number; errors: { file: string; error: string }[] }> {
  const { eventId, inviteId, files, contenuTexte } = args;
  if (files.length > MAX_PHOTOS_PER_POST) {
    throw new Error(`Maximum ${MAX_PHOTOS_PER_POST} photos par publication`);
  }
  const concurrency = Math.max(1, Math.min(args.concurrency ?? 5, 5));
  const total = files.length;
  const errors: { file: string; error: string }[] = [];
  let nextIndex = 0;
  // index -> uploaded URLs (preserve original order).
  const uploaded = new Array<UploadedPhoto | null>(total).fill(null);

  const runOne = async (i: number) => {
    const f = files[i];
    args.onProgress?.({ index: i, total, fileName: f.name, status: "uploading", percent: 0 });
    try {
      const u = await uploadOnePhoto(f, eventId, (pct) => {
        args.onProgress?.({ index: i, total, fileName: f.name, status: "uploading", percent: pct });
      });
      uploaded[i] = u;
      args.onProgress?.({ index: i, total, fileName: f.name, status: "done", percent: 100 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      errors.push({ file: f.name, error: msg });
      args.onProgress?.({ index: i, total, fileName: f.name, status: "error", percent: 0, error: msg });
    }
  };

  const workers: Promise<void>[] = [];
  const launch = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      await runOne(i);
    }
  };
  for (let w = 0; w < Math.min(concurrency, total); w++) workers.push(launch());
  await Promise.all(workers);

  const ok = uploaded.filter((u): u is UploadedPhoto => !!u);
  if (ok.length === 0) {
    return { ok: 0, errors };
  }

  // Create ONE post for the whole batch — keep legacy single-photo columns in
  // sync with position 0 so older queries keep working.
  const first = ok[0];
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .insert({
      event_id: eventId,
      invite_id: inviteId,
      contenu_texte: contenuTexte?.trim() || null,
      url_miniature: first.urlMini,
      url_medium: first.urlMedium,
      url_full: first.urlFull,
    })
    .select()
    .single();
  if (postErr || !post) {
    return { ok: 0, errors: [...errors, { file: "post", error: postErr?.message ?? "Création du post impossible" }] };
  }

  // Insert one row per photo into post_photos (preserve order via position).
  const rows = uploaded
    .map((u, idx) => (u ? { post_id: post.id, position: idx, url_miniature: u.urlMini, url_medium: u.urlMedium, url_full: u.urlFull } : null))
    .filter((r): r is NonNullable<typeof r> => !!r)
    // Re-position contiguously in case some uploads failed mid-batch.
    .map((r, i) => ({ ...r, position: i }));
  const { error: photosErr } = await supabase.from("post_photos").insert(rows);
  if (photosErr) {
    errors.push({ file: "post_photos", error: photosErr.message });
  }

  return { ok: ok.length, errors };
}

/**
 * Gallery upload — 1 post per photo, no 4-photo cap.
 * Uploads in parallel (concurrency 5) and creates one `posts` row per file.
 * Used by the FloatingUploadButton on the Gallery tab.
 */
export async function uploadGalleryBatch(args: {
  eventId: string;
  inviteId: string;
  files: File[];
  onProgress?: (p: UploadProgress) => void;
  concurrency?: number;
}): Promise<{ ok: number; errors: { file: string; error: string }[] }> {
  const { eventId, inviteId, files } = args;
  const concurrency = Math.max(1, Math.min(args.concurrency ?? 5, 5));
  const total = files.length;
  const errors: { file: string; error: string }[] = [];
  let nextIndex = 0;
  let okCount = 0;

  const runOne = async (i: number) => {
    const f = files[i];
    args.onProgress?.({ index: i, total, fileName: f.name, status: "uploading", percent: 0 });
    try {
      const u = await uploadOnePhoto(f, eventId, (pct) => {
        args.onProgress?.({ index: i, total, fileName: f.name, status: "uploading", percent: pct });
      });
      // Create a dedicated post for this photo.
      const { data: post, error: postErr } = await supabase
        .from("posts")
        .insert({
          event_id: eventId,
          invite_id: inviteId,
          contenu_texte: null,
          url_miniature: u.urlMini,
          url_medium: u.urlMedium,
          url_full: u.urlFull,
        })
        .select()
        .single();
      if (postErr || !post) throw new Error(postErr?.message ?? "Création du post impossible");
      const { error: phErr } = await supabase.from("post_photos").insert({
        post_id: post.id,
        position: 0,
        url_miniature: u.urlMini,
        url_medium: u.urlMedium,
        url_full: u.urlFull,
      });
      if (phErr) throw new Error(phErr.message);
      okCount++;
      args.onProgress?.({ index: i, total, fileName: f.name, status: "done", percent: 100 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      errors.push({ file: f.name, error: msg });
      args.onProgress?.({ index: i, total, fileName: f.name, status: "error", percent: 0, error: msg });
    }
  };

  const launch = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      await runOne(i);
    }
  };
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(concurrency, total); w++) workers.push(launch());
  await Promise.all(workers);

  return { ok: okCount, errors };
}

export async function createPost(args: {
  eventId: string;
  inviteId: string;
  contenuTexte?: string;
  files?: File[];
  onProgress?: (p: UploadProgress) => void;
}) {
  const trimmed = args.contenuTexte?.trim() || null;
  const files = args.files ?? [];
  if (!trimmed && files.length === 0) {
    throw new Error("Post vide");
  }

  if (files.length === 0) {
    // Pure text post.
    const { data, error } = await supabase
      .from("posts")
      .insert({
        event_id: args.eventId,
        invite_id: args.inviteId,
        contenu_texte: trimmed,
        url_miniature: null,
        url_medium: null,
        url_full: null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Photo(s) — upload to R2 in parallel.
  const result = await uploadPhotosBatch({
    eventId: args.eventId,
    inviteId: args.inviteId,
    files,
    contenuTexte: trimmed ?? undefined,
    onProgress: args.onProgress,
  });
  if (result.ok === 0) {
    throw new Error(result.errors[0]?.error ?? "Upload impossible");
  }
  return result;
}

export async function toggleLike(args: {
  photoId: string;
  inviteId: string;
  deviceId: string;
  currentlyLiked: boolean;
}) {
  if (args.currentlyLiked) {
    const { data, error } = await supabase.rpc("delete_own_like", {
      _photo_id: args.photoId,
      _device_id: args.deviceId,
    });
    if (error) throw error;
    return !data; // returns boolean indicating still liked
  }
  const { error } = await supabase
    .from("likes")
    .insert({ photo_id: args.photoId, invite_id: args.inviteId });
  if (error && error.code !== "23505") throw error;
  return true;
}

export async function addComment(args: {
  photoId: string;
  inviteId: string;
  contenu: string;
}) {
  const { data, error } = await supabase
    .from("commentaires")
    .insert({
      photo_id: args.photoId,
      invite_id: args.inviteId,
      contenu: args.contenu.trim(),
    })
    .select("*, invites(id, prenom)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOwnComment(commentId: string, deviceId: string) {
  const { data, error } = await supabase.rpc("delete_own_commentaire", {
    _commentaire_id: commentId,
    _device_id: deviceId,
  });
  if (error) throw error;
  return !!data;
}

export async function updateOwnInvite(args: {
  deviceId: string;
  eventId: string;
  avatarUrl?: string;
  email?: string;
  rgpdConsent?: boolean;
}) {
  const { data, error } = await supabase.rpc("update_own_invite", {
    _device_id: args.deviceId,
    _event_id: args.eventId,
    _avatar_url: args.avatarUrl,
    _email: args.email,
    _rgpd_consent: args.rgpdConsent,
  });
  if (error) throw error;
  return data as Tables<"invites">;
}