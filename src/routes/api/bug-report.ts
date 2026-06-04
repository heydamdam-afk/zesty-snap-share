import { createFileRoute } from "@tanstack/react-router";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SENDER_DOMAIN = "notify.kapsul.events";
const FROM = "Kapsul Bugs <bugs@notify.kapsul.events>";
const RECIPIENTS = ["debbito@gmail.com", "damien@baruuu.fr"];

const SeverityEnum = z.enum(["critique", "elevee", "moyenne", "faible"]);

const ScreenshotSchema = z.object({
  name: z.string().max(255),
  contentType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
  // data URL base64 (data:image/png;base64,xxx) — we store only the base64 portion length-capped below
  dataUrl: z.string().min(1).max(7_500_000), // ~5MB base64 ≈ 6.8MB
});

const BodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  severity: SeverityEnum.optional().default("moyenne"),
  asWho: z.string().trim().max(500).optional().default(""),
  wasDoing: z.string().trim().max(500).optional().default(""),
  wantedTo: z.string().trim().max(500).optional().default(""),
  expectedBehavior: z.string().trim().max(2000).optional().default(""),
  contactEmail: z.string().trim().email().max(255),
  contactPhone: z.string().trim().max(40).optional().default(""),
  pageUrl: z.string().max(2048).optional().default(""),
  browser: z.string().max(100).optional().default(""),
  os: z.string().max(100).optional().default(""),
  userAgent: z.string().max(500).optional().default(""),
  dateLabel: z.string().max(100).optional().default(""),
  screenshots: z.array(ScreenshotSchema).max(5).optional().default([]),
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

type ShotLink = { name: string; url: string };

function buildHtml(data: z.infer<typeof BodySchema>, ticketNumber: number | null, shotLinks: ShotLink[]): string {
  const imagesHtml = shotLinks.length
    ? `<div style="margin:24px 0 0"><div style="text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:#919EAB;font-weight:700;margin-bottom:12px">━━ CAPTURES (${shotLinks.length}) ━━</div>${shotLinks
        .map(
          (s) =>
            `<div style="margin:0 0 16px"><div style="font-size:12px;color:#637381;margin-bottom:4px">${escape(s.name)}</div><a href="${escape(s.url)}" style="color:#FF4842;font-size:13px;word-break:break-all">${escape(s.url)}</a><div style="margin-top:6px"><a href="${escape(s.url)}"><img src="${escape(s.url)}" alt="${escape(s.name)}" style="max-width:100%;border:1px solid #F4F6F8;border-radius:8px"/></a></div></div>`,
        )
        .join("")}</div>`
    : `<div style="margin:24px 0 0;color:#919EAB;font-size:13px">Aucune capture jointe.</div>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F6F8;font-family:'Public Sans',Arial,sans-serif;color:#212B36">
<div style="max-width:680px;margin:0 auto;padding:32px 24px">
  <div style="background:#fff;border-radius:12px;padding:28px 28px 32px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF4842"></span>
      <span style="text-transform:uppercase;letter-spacing:.1em;font-size:11px;color:#FF4842;font-weight:700">Bug report — kapsul.events</span>
    </div>
    <h1 style="font-family:'Josefin Sans',Arial,sans-serif;font-size:24px;margin:0 0 4px;color:#212B36">${escape(data.title)}</h1>
    <div style="color:#637381;font-size:13px">${ticketNumber ? `Ticket #${ticketNumber} — ` : ""}${escape(data.dateLabel || "")}</div>

    ${section(
      "DESCRIPTION",
      row("En tant que", data.asWho) +
        row("Je faisais", data.wasDoing) +
        row("Parce que je voulais", data.wantedTo) +
        row("Comportement attendu", data.expectedBehavior),
    )}
    ${section(
      "CONTACT",
      row("Email", data.contactEmail) + row("Téléphone", data.contactPhone),
    )}
    ${section(
      "CONTEXTE TECHNIQUE",
      row("URL", data.pageUrl) +
        row("Navigateur", data.browser) +
        row("OS", data.os) +
        row("Date/heure", data.dateLabel) +
        row("User agent", data.userAgent),
    )}
    ${imagesHtml}
  </div>
</div></body></html>`;
}

function buildText(data: z.infer<typeof BodySchema>, ticketNumber: number | null, shotLinks: ShotLink[]): string {
  return [
    `Bug report kapsul.events${ticketNumber ? ` — Ticket #${ticketNumber}` : ""}`,
    `Titre: ${data.title}`,
    `Date/heure: ${data.dateLabel || "Non renseigné"}`,
    "",
    "Description",
    `En tant que: ${data.asWho || "Non renseigné"}`,
    `Je faisais: ${data.wasDoing || "Non renseigné"}`,
    `Parce que je voulais: ${data.wantedTo || "Non renseigné"}`,
    `Comportement attendu: ${data.expectedBehavior || "Non renseigné"}`,
    "",
    "Contact",
    `Email: ${data.contactEmail}`,
    `Téléphone: ${data.contactPhone || "Non renseigné"}`,
    "",
    "Contexte technique",
    `URL: ${data.pageUrl || "Non renseigné"}`,
    `Navigateur: ${data.browser || "Non renseigné"}`,
    `OS: ${data.os || "Non renseigné"}`,
    `User agent: ${data.userAgent || "Non renseigné"}`,
    `Captures: ${shotLinks.length}`,
    ...shotLinks.map((s) => `- ${s.name}: ${s.url}`),
  ].join("\n");
}

export const Route = createFileRoute("/api/bug-report")({
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

        // Persist ticket first (so we have a ticket number).
        let ticketNumber: number | null = null;
        let ticketId: string | null = null;
        try {
          const { data: row, error } = await supabaseAdmin
            .from("bug_tickets")
            .insert({
              title: data.title,
              severity: data.severity,
              as_who: data.asWho || null,
              was_doing: data.wasDoing || null,
              wanted_to: data.wantedTo || null,
              expected_behavior: data.expectedBehavior || null,
              contact_email: data.contactEmail,
              contact_phone: data.contactPhone || null,
              page_url: data.pageUrl || null,
              browser: data.browser || null,
              os: data.os || null,
              user_agent: data.userAgent || null,
              screenshots_count: data.screenshots?.length ?? 0,
            })
            .select("id, ticket_number")
            .single();
          if (error) throw error;
          ticketNumber = row.ticket_number as number;
          ticketId = row.id as string;
        } catch (err) {
          console.error("[bug-report] failed to insert ticket", err);
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "Email service not configured" }, { status: 500 });
        }

        const subject = `[Bug${ticketNumber ? ` #${ticketNumber}` : ""}] ${data.title} — kapsul.events`;

        // Upload screenshots to private bucket and generate signed URLs (30 days).
        const shotLinks: ShotLink[] = [];
        const shots = data.screenshots ?? [];
        const folder = ticketId ?? `noid-${Date.now()}`;
        for (let i = 0; i < shots.length; i++) {
          const s = shots[i];
          try {
            const base64 = s.dataUrl.includes(",") ? s.dataUrl.split(",")[1] : s.dataUrl;
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const safeName = s.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "capture";
            const path = `${folder}/${i}-${safeName}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("bug-screenshots")
              .upload(path, bytes, { contentType: s.contentType, upsert: true });
            if (upErr) throw upErr;
            const { data: signed, error: sErr } = await supabaseAdmin.storage
              .from("bug-screenshots")
              .createSignedUrl(path, 60 * 60 * 24 * 30);
            if (sErr || !signed?.signedUrl) throw sErr ?? new Error("no signed url");
            shotLinks.push({ name: s.name, url: signed.signedUrl });
          } catch (err) {
            console.error("[bug-report] screenshot upload failed", { name: s.name, err });
          }
        }

        const html = buildHtml(data, ticketNumber, shotLinks);
        const text = buildText(data, ticketNumber, shotLinks) || `Bug report: ${data.title}`;

        // Ensure an unsubscribe token exists for each recipient (required by Lovable Emails).
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

        const results: Array<{ recipient: string; ok: boolean; error?: string }> = [];
        for (const recipient of RECIPIENTS) {
          try {
            const unsubscribeToken = await ensureUnsubscribeToken(recipient);
            const emailPayload = {
              to: recipient,
              from: FROM,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text,
              purpose: "transactional",
              label: "bug-report",
              reply_to: data.contactEmail,
              idempotency_key: `bug-report-${ticketId ?? "noid"}-${recipient}`,
              unsubscribe_token: unsubscribeToken,
            };
            console.log("[bug-report] sending email", {
              recipient,
              sender_domain: emailPayload.sender_domain,
              htmlLen: emailPayload.html.length,
            });
            await sendLovableEmail(emailPayload, {
              apiKey,
              sendUrl: process.env.LOVABLE_SEND_URL,
            });
            results.push({ recipient, ok: true });
            console.log("[bug-report] sent ok", { recipient });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[bug-report] email send failed", { recipient, msg });
            results.push({ recipient, ok: false, error: msg });
          }
        }

        const anyOk = results.some((r) => r.ok);
        const errorSummary = results
          .filter((r) => !r.ok)
          .map((r) => `${r.recipient}: ${r.error}`)
          .join(" | ");

        if (ticketId) {
          await supabaseAdmin
            .from("bug_tickets")
            .update({
              email_sent: anyOk,
              email_error: errorSummary ? errorSummary.slice(0, 1000) : null,
            })
            .eq("id", ticketId);
        }

        if (!anyOk) {
          return Response.json(
            { error: "Email send failed", ticketNumber, results },
            { status: 502 },
          );
        }

        return Response.json({ ok: true, ticketNumber, results });
      },
    },
  },
});