import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * GET /api/public/n8n/marketing-to-sync?limit=100
 * Auth: Authorization: Bearer <N8N_CRON_SECRET>
 * Returns contacts with rgpd_consent=true AND brevo_synced=false.
 */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/n8n/marketing-to-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) return json(500, { error: "Server not configured" });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) return json(401, { error: "Unauthorized" });

        const url = new URL(request.url);
        const rawLimit = url.searchParams.get("limit") ?? "100";
        let limit = Number.parseInt(rawLimit, 10);
        if (!Number.isInteger(limit) || limit < 1) limit = 100;
        if (limit > 500) limit = 500;

        const { data, error } = await supabaseAdmin
          .from("marketing_contacts")
          .select("id, email, prenom, role, event_id, nom_event, date_event, statut_event")
          .eq("rgpd_consent", true)
          .eq("brevo_synced", false)
          .order("created_at", { ascending: true })
          .limit(limit);
        if (error) return json(500, { error: "DB error", message: error.message });

        return json(200, { ok: true, count: data?.length ?? 0, contacts: data ?? [] });
      },
    },
  },
});