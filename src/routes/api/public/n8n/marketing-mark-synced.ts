import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * POST /api/public/n8n/marketing-mark-synced
 * Auth: Authorization: Bearer <N8N_CRON_SECRET>
 * Body: { ids: string[] (uuid) }
 * Marks the given marketing_contacts rows as synced to Brevo.
 */

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/n8n/marketing-mark-synced")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) return json(500, { error: "Server not configured" });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) return json(401, { error: "Unauthorized" });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return json(400, { error: "Invalid body", details: parsed.error.issues });
        }

        const { data, error } = await supabaseAdmin
          .from("marketing_contacts")
          .update({ brevo_synced: true })
          .in("id", parsed.data.ids)
          .select("id");
        if (error) return json(500, { error: "DB error", message: error.message });

        return json(200, { ok: true, updated_count: data?.length ?? 0 });
      },
    },
  },
});