import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Endpoint called by n8n once the freeze ZIP is generated.
 *
 * Auth: Bearer token equal to N8N_CRON_SECRET.
 * Body: { event_id: uuid, zip_download_url: string (https URL) }
 *
 * Effect (service_role, bypasses RLS):
 *   - status = 'frozen'
 *   - frozen_at = now()
 *   - zip_download_url = <value>
 *   - uploads_actifs / commentaires_actifs / likes_actifs = false
 */

const BodySchema = z.object({
  event_id: z.string().uuid(),
  zip_download_url: z.string().url().max(2048),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/freeze-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) return json(500, { error: "Server not configured" });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) {
          return json(401, { error: "Unauthorized" });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: "Invalid JSON" });
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return json(400, {
            error: "Invalid body",
            details: parsed.error.issues,
          });
        }

        const { event_id, zip_download_url } = parsed.data;

        const { data: ev, error: readErr } = await supabaseAdmin
          .from("events")
          .select("id, status")
          .eq("id", event_id)
          .maybeSingle();
        if (readErr) {
          return json(500, { error: "DB read failed", message: readErr.message });
        }
        if (!ev) return json(404, { error: "Event not found" });

        if (ev.status === "frozen") {
          return json(200, { success: true });
        }

        const { error: updErr } = await supabaseAdmin
          .from("events")
          .update({
            status: "frozen",
            frozen_at: new Date().toISOString(),
            zip_download_url,
            uploads_actifs: false,
            commentaires_actifs: false,
            likes_actifs: false,
          })
          .eq("id", event_id);

        if (updErr) {
          return json(500, { error: "DB update failed", message: updErr.message });
        }

        return json(200, { success: true });
      },
    },
  },
});