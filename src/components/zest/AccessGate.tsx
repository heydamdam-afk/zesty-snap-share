import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ZestLogo } from "./Logo";
import { event } from "@/data/mock-event";

const EVENT_CODE = "SABRINA-THOMAS";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code trop court")
    .max(64, "Code trop long"),
  name: z
    .string()
    .trim()
    .min(2, "Prénom trop court")
    .max(40, "Prénom trop long"),
});

export type GuestSession = { name: string; initials: string; code: string };

const STORAGE_KEY = "zest.guest";

export function loadGuest(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function clearGuest() {
  localStorage.removeItem(STORAGE_KEY);
}

function makeInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function AccessGate({ onEnter }: { onEnter: (g: GuestSession) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ code, name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    setLoading(true);
    // Mock validation : on accepte n'importe quel code non vide en v1.
    // Quand on branchera Supabase, on vérifiera ici contre la table events.
    setTimeout(() => {
      const cleanName = parsed.data.name;
      const session: GuestSession = {
        name: cleanName,
        initials: makeInitials(cleanName) || "?",
        code: parsed.data.code.toUpperCase(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      onEnter(session);
    }, 300);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[image:var(--gradient-warm)]">
      <div
        className="absolute inset-0 -z-10 opacity-25"
        style={{
          backgroundImage: `url(${event.cover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(24px) saturate(1.1)",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-background/40" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full rounded-3xl bg-card/95 p-7 shadow-card backdrop-blur"
        >
          <div className="mb-6 flex items-center justify-between">
            <ZestLogo />
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              Galerie privée
            </span>
          </div>

          <h1 className="font-serif text-3xl leading-tight text-foreground">
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.date} · {event.location}
          </p>

          <div className="my-6 h-px bg-border" />

          <p className="mb-5 text-sm text-foreground/80">
            Entre le code reçu sur ton invitation et ton prénom pour rejoindre
            la galerie.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Code de l'événement
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SABRINA-THOMAS"
                autoComplete="off"
                maxLength={64}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-base uppercase tracking-wider text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Ton prénom
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Camille"
                autoComplete="given-name"
                maxLength={40}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Rejoindre la galerie"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Pas de compte à créer. Ton prénom sera affiché sur tes photos.
          </p>
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground">
          Code de démo : <span className="font-mono">{EVENT_CODE}</span>
        </p>
      </div>
    </div>
  );
}