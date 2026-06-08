import { createFileRoute } from "@tanstack/react-router";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SENDER_DOMAIN = "notify.kapsul.events";
const FROM = "Kapsul Feedback <feedback@notify.kapsul.events>";
const RECIPIENT = "dbreteau@gmail.com";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  asWho: z.string().trim().min(1).max(500),
  wantTo: z.string().trim().min(1).max(500),
  because: z.string().trim().min(1).max(1000),
  details: z.string().trim().max(2000).optional().default(""),
  beneficiaries: z.array(z.string().max(80)).max(10).optional().default([]),
  importance: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  dateIso: z.string().max(40).optional().default(""),
});

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  const v = value && value.trim().length > 0 ? escape(value) : '<span style="color:#919EAB">Non renseigné</span>';
  return `<tr><td style="padding:6px 12px 6px 0;color:#637381;font-size:13px;vertical-align:top;white-space:nowrap"><strong>${escape(label)}</strong></td><td style="padding:6px 0;color:#212B36;font-size:14px">${v}</td></tr>`;
}

function section(title: string, inner: string): string {
  return `<div style="margin:24px 0 0"><div style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:#919EAB;font-weight:700;margin-bottom:8px">━━ ${escape(title)} ━━</div><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${inner}</table></div>`;
}

function buildHtml(d: z.infer<typeof BodySchema>): string {
  const beneficiaries = d.beneficiaries.length ? d.beneficiaries.join(", ") : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F6F8;font-family:'Public Sans',Arial,sans-serif;color:#212B36">
<div style="max-width:680px;margin:0 auto;padding:32px 24px">
  <div style="background:#fff;border-radius:12px;padding:28px 28px 32px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF4842"></span>
      <span style="text-transform:uppercase;letter-spacing:.1em;font-size:11px;color:#FF4842;font-weight:700">Nouvelle feature — kapsul.events</span>
    </div>
    <h1 style="font-family:'Josefin Sans',Arial,sans-serif;font-size:24px;margin:0 0 4px;color:#212B36">${escape(d.name)}</h1>
    <div style="color:#637381;font-size:13px">${escape(d.dateIso || "")}</div>

    ${section(
      "BESOIN (USER STORY)",
      row("En tant que", d.asWho) + row("Je veux", d.wantTo) + row("Parce que", d.because) + row("Détail du besoin", d.details),
    )}
    ${section(
      "CONTEXTE",
      row("Bénéficiaires", beneficiaries) + row("Importance", d.importance),
    )}
    ${section(
      "CONTACT",
      row("Email", d.email) + row("Téléphone", d.phone),
    )}
  </div>
</div></body></html>`;
}

function buildText(d: z.infer<typeof BodySchema>): string {
  return [
    "Kapsul : nouvelle feature",
    `Nom de la fonctionnalité : ${d.name}`,
    "",
    "Description du besoin :",
    `  En tant que : ${d.asWho}`,
    `  Je veux : ${d.wantTo}`,
    `  Parce que : ${d.because}`,
    `  Détail du besoin : ${d.details || "Non renseigné"}`,
    "",
    `Bénéficiaires : ${d.beneficiaries.length ? d.beneficiaries.join(", ") : "Non renseigné"}`,
    `Importance : ${d.importance}`,
    `Email : ${d.email}`,
    `Téléphone : ${d.phone || "Non renseigné"}`,
    `Date : ${d.dateIso || ""}`,
  ].join("\n");
}

export const Route = createFileRoute("/api/feature-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const data = parsed.data;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "Email service not configured" }, { status: 500 });
        }

        async function ensureUnsubscribeToken(email: string): Promise<string> {
          const { data: existing } = await supabaseAdmin
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", email)
            .maybeSingle();
          if (existing?.token) return existing.token as string;
          const newToken = crypto.randomUUID();
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("email_unsubscribe_tokens")
            .insert({ token: newToken, email })
            .select("token")
            .single();
          if (insErr) throw insErr;
          return inserted.token as string;
        }

        try {
          const unsubscribeToken = await ensureUnsubscribeToken(RECIPIENT);
          await sendLovableEmail(
            {
              to: RECIPIENT,
              from: FROM,
              sender_domain: SENDER_DOMAIN,
              subject: "Kapsul : nouvelle feature",
              html: buildHtml(data),
              text: buildText(data),
              purpose: "transactional",
              label: "feature-request",
              reply_to: data.email,
              idempotency_key: `feature-request-${data.email}-${Date.now()}`,
              unsubscribe_token: unsubscribeToken,
            },
            {
              apiKey,
              sendUrl: process.env.LOVABLE_SEND_URL,
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[feature-request] email send failed", msg);
          return Response.json({ error: "Email send failed" }, { status: 502 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});