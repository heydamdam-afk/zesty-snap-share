import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * GET /api/public/n8n/events-to-freeze
 * Auth: Authorization: Bearer <N8N_CRON_SECRET>
 * Returns events expired for > 7 days (status='expired'), with admin emails.
 * n8n then generates the ZIP and calls POST /api/public/freeze-complete.
 */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/n8n/events-to-freeze")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) return json(500, { error: "Server not configured" });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) return json(401, { error: "Unauthorized" });

        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: events, error } = await supabaseAdmin
          .from("events")
          .select("id, titre, slug, expire_at")
          .eq("status", "expired")
          .lt("expire_at", cutoff);
        if (error) return json(500, { error: "DB error", message: error.message });

        const ids = (events ?? []).map((e) => e.id);
        let adminsByEvent: Record<string, string[]> = {};
        if (ids.length > 0) {
          const { data: admins, error: aErr } = await supabaseAdmin
            .from("event_admins")
            .select("event_id, email")
            .in("event_id", ids);
          if (aErr) return json(500, { error: "DB error", message: aErr.message });
          adminsByEvent = (admins ?? []).reduce<Record<string, string[]>>((acc, a) => {
            if (!a.email) return acc;
            (acc[a.event_id] ||= []).push(a.email);
            return acc;
          }, {});
        }

        const result = (events ?? []).map((e) => ({
          event_id: e.id,
          titre: e.titre,
          slug: e.slug,
          expire_at: e.expire_at,
          admins_emails: adminsByEvent[e.id] ?? [],
        }));

        return json(200, { ok: true, count: result.length, events: result });
      },
    },
  },
});