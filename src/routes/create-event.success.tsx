import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ZestLogo } from "@/components/zest/Logo";
import { Check, Copy, ExternalLink } from "lucide-react";

type Search = { slug?: string; code?: string };

export const Route = createFileRoute("/create-event/success")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    slug: typeof s.slug === "string" ? s.slug : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
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
  const { slug, code } = Route.useSearch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const url =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/e/${slug}`
      : "";

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

  if (!slug || !code) {
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