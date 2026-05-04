import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deleteR2Key, keyFromPublicUrl } from "./r2.server";

const deleteInput = z.object({
  eventId: z.string().uuid(),
  adminToken: z.string().min(10),
  confirmTitre: z.string().min(1).max(200),
});

/**
 * Hard-delete an event and all its dependent data.
 * Authorization: caller must be the *organisateur* of the event.
 */
export const deleteEventCascade = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteInput.parse(data))
  .handler(async ({ data }) => {
    // 1. Identify caller via supabase access token
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(
      data.adminToken,
    );
    if (userErr || !userRes.user?.email) {
      throw new Error("Session invalide");
    }
    const callerEmail = userRes.user.email.toLowerCase();

    // 2. Load event + verify caller is organisateur
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, titre")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr || !ev) throw new Error("Événement introuvable");
    if (ev.titre.trim() !== data.confirmTitre.trim()) {
      throw new Error("Le titre de confirmation ne correspond pas.");
    }

    const { data: adm } = await supabaseAdmin
      .from("event_admins")
      .select("id, role, email")
      .eq("event_id", ev.id)
      .ilike("email", callerEmail)
      .maybeSingle();
    if (!adm || adm.role !== "organisateur") {
      throw new Error("Seul l'organisateur peut supprimer cet événement.");
    }

    // 3. Collect all R2 keys from posts + post_photos
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, url_full, url_medium, url_miniature")
      .eq("event_id", ev.id);
    const postIds = (posts ?? []).map((p) => p.id);

    const keys = new Set<string>();
    for (const p of posts ?? []) {
      for (const u of [p.url_full, p.url_medium, p.url_miniature]) {
        const k = u ? keyFromPublicUrl(u) : null;
        if (k) keys.add(k);
      }
    }
    if (postIds.length > 0) {
      const { data: photos } = await supabaseAdmin
        .from("post_photos")
        .select("url_full, url_medium, url_miniature")
        .in("post_id", postIds);
      for (const ph of photos ?? []) {
        for (const u of [ph.url_full, ph.url_medium, ph.url_miniature]) {
          const k = u ? keyFromPublicUrl(u) : null;
          if (k) keys.add(k);
        }
      }
    }

    // 4. Best-effort R2 cleanup
    for (const k of keys) {
      try {
        await deleteR2Key(k);
      } catch (e) {
        console.error("R2 delete failed during event cascade", k, e);
      }
    }

    // 5. DB cascade — order matters (children first)
    if (postIds.length > 0) {
      await supabaseAdmin.from("commentaires").delete().in("photo_id", postIds);
      await supabaseAdmin.from("likes").delete().in("photo_id", postIds);
      await supabaseAdmin.from("post_photos").delete().in("post_id", postIds);
      await supabaseAdmin.from("posts").delete().in("id", postIds);
    }
    await supabaseAdmin.from("event_bans").delete().eq("event_id", ev.id);
    await supabaseAdmin.from("banned_invites").delete().eq("event_id", ev.id);
    await supabaseAdmin.from("invites").delete().eq("event_id", ev.id);
    await supabaseAdmin.from("event_admins").delete().eq("event_id", ev.id);

    const { error: delErr } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", ev.id);
    if (delErr) throw delErr;

    return { ok: true as const };
  });