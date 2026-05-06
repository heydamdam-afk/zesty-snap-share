import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildPhotoKey,
  publicUrlFor,
  putR2Object,
} from "@/server/r2.server";

/**
 * Proxy backend pour les uploads R2.
 *
 * Le navigateur POST un multipart/form-data ici, le serveur valide puis
 * écrit l'objet directement dans R2 via le SDK serveur (aws4fetch).
 * Aucune presigned URL n'est exposée au navigateur.
 */

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 50 * 1024 * 1024;

const FieldsSchema = z.object({
  eventId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export const Route = createFileRoute("/api/public/r2-upload")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch (e) {
          return json({ error: "Body multipart/form-data invalide" }, 400);
        }

        const parsed = FieldsSchema.safeParse({
          eventId: form.get("eventId"),
          inviteId: form.get("inviteId"),
        });
        if (!parsed.success) {
          return json({ error: "Champs eventId / inviteId invalides" }, 400);
        }
        const { eventId, inviteId } = parsed.data;

        const file = form.get("file");
        if (!(file instanceof File)) {
          return json({ error: "Fichier manquant (champ `file`)" }, 400);
        }

        const contentType = (file.type || "").toLowerCase();
        if (!ALLOWED_TYPES.has(contentType)) {
          return json({ error: `Format non supporté (${contentType || "inconnu"})` }, 415);
        }
        if (file.size <= 0) {
          return json({ error: "Fichier vide" }, 400);
        }
        if (file.size > MAX_BYTES) {
          return json({ error: "Fichier trop volumineux (max 50 Mo)" }, 413);
        }

        // Vérifie que l'event existe et est actif.
        const { data: ev, error: evErr } = await supabaseAdmin
          .from("events")
          .select("id, status")
          .eq("id", eventId)
          .maybeSingle();
        if (evErr || !ev) return json({ error: "Événement introuvable" }, 404);
        if (ev.status !== "active") return json({ error: "Événement clôturé" }, 403);

        // Vérifie que l'invite appartient bien à cet event.
        const { data: inv, error: invErr } = await supabaseAdmin
          .from("invites")
          .select("id, event_id")
          .eq("id", inviteId)
          .maybeSingle();
        if (invErr || !inv || inv.event_id !== eventId) {
          return json({ error: "Invité non autorisé pour cet événement" }, 403);
        }

        // Génère la clé R2.
        const ext =
          (file.name.split(".").pop() || contentType.split("/").pop() || "jpg")
            .toLowerCase();
        const key = buildPhotoKey(eventId, ext);

        // Lit le body et l'envoie à R2 côté serveur.
        let buffer: ArrayBuffer;
        try {
          buffer = await file.arrayBuffer();
        } catch (e) {
          return json({ error: "Lecture du fichier impossible" }, 400);
        }

        try {
          await putR2Object(key, buffer, contentType);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erreur R2";
          console.error("[r2-upload] putR2Object failed", { key, msg });
          return json({ error: `Upload R2 échoué — ${msg}` }, 502);
        }

        const urlFull = publicUrlFor(key);
        return json({
          key,
          urlFull,
          urlMedium: `${urlFull}?width=800`,
          urlMini: `${urlFull}?width=400`,
        });
      },
    },
  },
});