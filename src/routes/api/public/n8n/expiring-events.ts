import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * GET /api/public/n8n/expiring-events?days=30
 * Auth: Authorization: Bearer <N8N_CRON_SECRET>
 * Returns events expiring on exactly today + N days (UTC), with owner info.
 */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/n8n/expiring-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) return json(500, { error: "Server not configured" });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) return json(401, { error: "Unauthorized" });

        const url = new URL(request.url);
        const rawDays = url.searchParams.get("days") ?? "30";
        const days = Number.parseInt(rawDays, 10);
        if (!Number.isInteger(days) || days < 0 || days > 365) {
          return json(400, { error: "Invalid days param (0-365)" });
        }

        const { data, error } = await supabaseAdmin.rpc(
          "get_expiring_events_in_days",
          { _days: days },
        );
        if (error) {
          return json(500, { error: "DB error", message: error.message });
        }

        return json(200, { ok: true, days, events: data ?? [] });
      },
    },
  },
});