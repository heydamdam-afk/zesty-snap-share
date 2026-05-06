import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Endpoint called by n8n to transition event statuses.
 *
 * Auth: Bearer token equal to N8N_CRON_SECRET.
 * Body: { id: string (uuid), status: "expired" | "archived" }
 *
 * Allowed transitions (server-enforced):
 *   - active   -> expired
 *   - expired  -> archived
 */

const BodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["expired", "archived"]),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  active: ["expired"],
  expired: ["archived"],
};

function unauthorized(msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/expire-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.N8N_CRON_SECRET;
        if (!secret) {
          return new Response(
            JSON.stringify({ error: "Server not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token || token !== secret) return unauthorized();

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Invalid body", details: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { id, status: nextStatus } = parsed.data;

        // Read current status to enforce the transition rules.
        const { data: ev, error: readErr } = await supabaseAdmin
          .from("events")
          .select("id, status")
          .eq("id", id)
          .maybeSingle();
        if (readErr) {
          return new Response(
            JSON.stringify({ error: "DB read failed", message: readErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!ev) {
          return new Response(JSON.stringify({ error: "Event not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const allowed = ALLOWED_TRANSITIONS[ev.status] ?? [];
        if (!allowed.includes(nextStatus)) {
          return new Response(
            JSON.stringify({
              error: "Invalid transition",
              from: ev.status,
              to: nextStatus,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }

        const { error: updErr } = await supabaseAdmin
          .from("events")
          .update({ status: nextStatus })
          .eq("id", id);
        if (updErr) {
          return new Response(
            JSON.stringify({ error: "DB update failed", message: updErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ ok: true, id, from: ev.status, to: nextStatus }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});