import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ZestLogo } from "@/components/zest/Logo";
import { Check, Copy, ExternalLink, Loader2, Mail } from "lucide-react";
import { lookupEventBySessionId } from "@/lib/create-event.functions";
import { logFlowClient } from "@/lib/flow-log-client";

type Search = { slug?: string; code?: string; session_id?: string };

export const Route = createFileRoute("/create-event/success")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    slug: typeof s.slug === "string" ? s.slug : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Événement créé — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const search = Route.useSearch();
  const lookup = useServerFn(lookupEventBySessionId);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [resolved, setResolved] = useState<{ slug: string; code?: string } | null>(
    search.slug ? { slug: search.slug, code: search.code } : null,
  );
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    logFlowClient({ step: 'success_page_view', stripeSessionId: search.session_id ?? null, slug: search.slug ?? null });
  }, [search.session_id, search.slug]);

  // Poll if we only have session_id (paid flow)
  useEffect(() => {
    if (resolved || !search.session_id) return;
    let cancel = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await lookup({ data: { sessionId: search.session_id! } });
        if (cancel) return;
        if (res.ready) {
          logFlowClient({
            step: 'paid_redirect',
            status: 'success',
            stripeSessionId: search.session_id ?? null,
            eventId: res.eventId,
            slug: res.slug,
            context: { needsSetPassword: res.needsSetPassword, tries },
          });
          // Redirect post-checkout straight into the login page.
          // First-time buyer (no password yet) → set-password mode.
          // Returning buyer (already has a password) → classic signin.
          const redirect = `/${res.slug}/admin/dashboard`;
          const qs = new URLSearchParams();
          if (res.needsSetPassword) qs.set("mode", "set-password");
          qs.set("redirect", redirect);
          if (typeof window !== "undefined") {
            window.location.replace(`/login?${qs.toString()}`);
          }
          setResolved({ slug: res.slug });
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries > 30) {
        logFlowClient({ step: 'paid_poll_timeout', status: 'error', stripeSessionId: search.session_id ?? null, errorCode: 'poll_timeout', context: { tries } });
        setPollError("Le paiement est en cours de validation. Vérifiez vos emails dans quelques instants.");
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancel = true;
    };
  }, [resolved, search.session_id, lookup]);

  const slug = resolved?.slug;
  const code = resolved?.code;
  const url = slug && typeof window !== "undefined" ? `${window.location.origin}/e/${slug}` : "";

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 240,
      margin: 1,
      color: { dark: "#212B36", light: "#FFFFFF" },
    }).catch(() => {});
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  if (!slug && !search.session_id) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="text-center">
          <p className="text-muted-foreground">Lien invalide.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary">
            ← Retour
          </Link>
        </div>
      </div>
    );
  }

  // Polling state
  if (!slug) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Paiement reçu !</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pollError ?? "Création de votre événement en cours…"}
          </p>
          {pollError && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Mail className="h-4 w-4" /> Un email vous a été envoyé
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="mb-6">
          <ZestLogo />
        </div>

        <div className="w-full rounded-3xl bg-card/95 p-7 text-center shadow-card backdrop-blur">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl text-foreground">
            Votre event est prêt !
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Partagez le QR code à vos invités pour qu'ils rejoignent la galerie.
          </p>

          <div className="mx-auto mt-6 inline-block rounded-2xl bg-card p-4 shadow-card">
            <canvas ref={canvasRef} className="block" />
          </div>

          <p className="mt-5 text-xs uppercase tracking-wide text-muted-foreground">
            Code d'accès
          </p>
          <p className="font-display text-3xl font-bold text-primary">{code}</p>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-left">
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {url}
            </span>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/$slug/admin/dashboard"
              params={{ slug }}
              className="w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground shadow-soft"
            >
              Ouvrir le tableau de bord
            </Link>
            <Link
              to="/e/$slug"
              params={{ slug }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-5 py-3 text-center text-sm font-medium text-foreground hover:bg-secondary"
            >
              Voir la galerie <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}