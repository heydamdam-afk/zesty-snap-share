import { useRef, useState } from "react";
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
  email: z
    .string()
    .trim()
    .max(255, "Email trop long")
    .email("Email invalide")
    .optional()
    .or(z.literal("")),
});

export type GuestSession = {
  name: string;
  initials: string;
  code: string;
  email: string;
  avatar?: string;
};

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
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image trop lourde (max 5 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ code, name, email });
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
        email: parsed.data.email.toLowerCase(),
        avatar,
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
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary/60 transition hover:border-primary hover:bg-secondary"
                aria-label="Ajouter une photo de profil"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Aperçu de votre photo de profil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground group-hover:text-primary">
                    +
                  </span>
                )}
              </button>
              <div className="text-sm">
                <p className="font-medium text-foreground">Photo de profil</p>
                <p className="text-xs text-muted-foreground">
                  Optionnelle · JPG ou PNG · 5 Mo max
                </p>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar(undefined)}
                    className="mt-1 text-xs text-primary hover:underline"
                  >
                    Retirer
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickAvatar(e.target.files?.[0])}
              />
            </div>

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

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camille@email.com"
                autoComplete="email"
                maxLength={255}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pour recevoir l'album souvenir après l'événement.
              </p>
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