import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildPhotoKey,
  deleteR2Key,
  keyFromPublicUrl,
  publicUrlFor,
  signPutUrl,
} from "./r2.server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 50 * 1024 * 1024;

const createInput = z.object({
  eventId: z.string().uuid(),
  contentType: z.string().min(3).max(100),
  ext: z.string().min(1).max(8),
  size: z.number().int().min(1).max(MAX_BYTES),
});

export const createR2UploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data }) => {
    if (!ALLOWED_TYPES.has(data.contentType.toLowerCase())) {
      throw new Error("Format non supporté");
    }
    // Ensure event exists & is active.
    const { data: ev, error } = await supabaseAdmin
      .from("events")
      .select("id, status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !ev) throw new Error("Événement introuvable");
    if (ev.status !== "active") throw new Error("Événement clôturé");

    const key = buildPhotoKey(data.eventId, data.ext);
    const uploadUrl = await signPutUrl(key, data.contentType);
    const fullUrl = publicUrlFor(key);
    return {
      uploadUrl,
      key,
      urlFull: fullUrl,
      urlMedium: `${fullUrl}?width=800`,
      urlMini: `${fullUrl}?width=400`,
    };
  });

const deleteInput = z.object({
  postId: z.string().uuid(),
  deviceId: z.string().min(8).max(128).optional(),
});

/**
 * Delete a post + its R2 object.
 * Authorization:
 *  - the caller is the owning invite (matches device_id), OR
 *  - the caller is an authenticated admin of the event.
 */
export const deletePostWithR2 = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteInput.parse(data))
  .handler(async ({ data }) => {
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("id, event_id, url_full, url_medium, url_miniature, invites:invite_id(device_id)")
      .eq("id", data.postId)
      .maybeSingle();
    if (error || !post) throw new Error("Post introuvable");

    let allowed = false;
    const ownerDevice = (post.invites as { device_id: string } | null)?.device_id;
    if (data.deviceId && ownerDevice && data.deviceId === ownerDevice) {
      allowed = true;
    }

    if (!allowed) {
      // Check admin via the auth header on the request (if any).
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const token = auth.slice(7);
        const { data: userRes } = await supabaseAdmin.auth.getUser(token);
        const uid = userRes.user?.id;
        if (uid) {
          const { data: adm } = await supabaseAdmin
            .from("event_admins")
            .select("id")
            .eq("event_id", post.event_id)
            .eq("user_id", uid)
            .maybeSingle();
          if (adm) allowed = true;
        }
      }
    }

    if (!allowed) throw new Error("Non autorisé");

    // Delete R2 object (best-effort) — try every URL field.
    const keys = new Set<string>();
    for (const u of [post.url_full, post.url_medium, post.url_miniature]) {
      const k = u ? keyFromPublicUrl(u) : null;
      if (k) keys.add(k);
    }
    for (const k of keys) {
      try { await deleteR2Key(k); } catch (e) { console.error("R2 delete", k, e); }
    }

    // Delete DB row (cascade deletes likes/commentaires via FKs if defined;
    // otherwise we delete them explicitly to be safe).
    await supabaseAdmin.from("commentaires").delete().eq("photo_id", data.postId);
    await supabaseAdmin.from("likes").delete().eq("photo_id", data.postId);
    const { error: delErr } = await supabaseAdmin.from("posts").delete().eq("id", data.postId);
    if (delErr) throw delErr;

    return { ok: true as const };
  });