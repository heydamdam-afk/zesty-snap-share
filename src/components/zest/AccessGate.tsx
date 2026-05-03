import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Check } from "lucide-react";
import { ZestLogo } from "./Logo";
import { event } from "@/data/mock-event";

function Badge({
  tone,
  children,
}: {
  tone: "required" | "recommended" | "optional";
  children: React.ReactNode;
}) {
  const styles = {
    required: "bg-primary/10 text-primary",
    recommended: "bg-accent/15 text-accent-foreground",
    optional: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {children}
    </span>
  );
}

const EVENT_CODE = "JULIE2026";
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;

// Palette douce pour avatars auto-générés
const AVATAR_PALETTE = [
  "#FFB199",
  "#A0D8B3",
  "#9FC5E8",
  "#F4C2C2",
  "#D6B3E5",
  "#FFD59E",
  "#B5D8D8",
  "#F2A6A6",
];

function pickAvatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const schema = z.object({
  code: z.string().trim().min(1, "Code requis").max(64, "Code trop long"),
  prenom: z
    .string()
    .trim()
    .min(2, "Prénom trop court")
    .max(40, "Prénom trop long"),
  email: z
    .string()
    .trim()
    .email("Email invalide")
    .max(255, "Email trop long")
    .optional()
    .or(z.literal("")),
});

export type GuestSession = {
  deviceId: string;
  prenom: string;
  initial: string;
  avatarColor: string;
  eventId: string;
  avatarUrl?: string;
  email?: string;
  rgpdAccepted?: boolean;
};

const STORAGE_KEYS = {
  deviceId: "zeste_device_id",
  prenom: "zeste_prenom",
  eventId: "zeste_event_id",
  avatarUrl: "zeste_avatar_url",
  email: "zeste_email",
  rgpd: "zeste_rgpd_accepted",
  attempts: "zeste_login_attempts",
  lockUntil: "zeste_login_lock_until",
} as const;

export function loadGuest(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
    const prenom = localStorage.getItem(STORAGE_KEYS.prenom);
    const eventId = localStorage.getItem(STORAGE_KEYS.eventId);
    if (!deviceId || !prenom || !eventId) return null;
    const avatarUrl = localStorage.getItem(STORAGE_KEYS.avatarUrl) || undefined;
    const email = localStorage.getItem(STORAGE_KEYS.email) || undefined;
    const rgpdAccepted =
      localStorage.getItem(STORAGE_KEYS.rgpd) === "1" ? true : false;
    const initial = (prenom[0] ?? "?").toUpperCase();
    return {
      deviceId,
      prenom,
      initial,
      avatarColor: pickAvatarColor(prenom),
      eventId,
      avatarUrl: avatarUrl && avatarUrl !== "null" ? avatarUrl : undefined,
      email,
      rgpdAccepted,
    };
  } catch {
    return null;
  }
}

export function clearGuest() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}

function readAttempts() {
  const lockUntil = Number(localStorage.getItem(STORAGE_KEYS.lockUntil) || 0);
  if (lockUntil && Date.now() < lockUntil) {
    return { locked: true, lockUntil, count: MAX_ATTEMPTS };
  }
  if (lockUntil && Date.now() >= lockUntil) {
    localStorage.removeItem(STORAGE_KEYS.lockUntil);
    localStorage.removeItem(STORAGE_KEYS.attempts);
  }
  const count = Number(localStorage.getItem(STORAGE_KEYS.attempts) || 0);
  return { locked: false, lockUntil: 0, count };
}

export function AccessGate({ onEnter }: { onEnter: (g: GuestSession) => void }) {
  const [code, setCode] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [rgpd, setRgpd] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(undefined);

  const [errors, setErrors] = useState<{
    code?: string;
    prenom?: string;
    email?: string;
    global?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate état lockout / tentatives
  useEffect(() => {
    const a = readAttempts();
    if (a.locked) setLockUntil(a.lockUntil);
  }, []);

  // Tick chaque seconde si verrouillé
  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  const isLocked = lockUntil > now;
  const remainingMin = Math.ceil((lockUntil - now) / 60000);

  const previewColor = pickAvatarColor(prenom || "?");
  const previewInitial = (prenom.trim()[0] ?? "?").toUpperCase();

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, global: "Le fichier doit être une image" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((e) => ({ ...e, global: "Image trop lourde (max 5 Mo)" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      setErrors((e) => ({ ...e, global: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setErrors({});

    const parsed = schema.safeParse({ code, prenom, email });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    // Mock validation : on accepte EVENT_CODE (insensible à la casse).
    setTimeout(() => {
      const upper = parsed.data.code.toUpperCase();
      const valid = upper === EVENT_CODE;

      if (!valid) {
        const next = Number(localStorage.getItem(STORAGE_KEYS.attempts) || 0) + 1;
        localStorage.setItem(STORAGE_KEYS.attempts, String(next));
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          localStorage.setItem(STORAGE_KEYS.lockUntil, String(until));
          setLockUntil(until);
          setNow(Date.now());
          setErrors({
            global:
              "Trop de tentatives. Réessayez dans 5 minutes.",
          });
        } else {
          setErrors({
            code: `Code incorrect (${MAX_ATTEMPTS - next} tentative${
              MAX_ATTEMPTS - next > 1 ? "s" : ""
            } restante${MAX_ATTEMPTS - next > 1 ? "s" : ""})`,
          });
        }
        setLoading(false);
        return;
      }

      // Succès → reset compteurs + écriture localStorage spec
      localStorage.removeItem(STORAGE_KEYS.attempts);
      localStorage.removeItem(STORAGE_KEYS.lockUntil);

      const cleanPrenom = parsed.data.prenom;
      const cleanEmail = parsed.data.email
        ? parsed.data.email.toLowerCase()
        : undefined;
      const deviceId = uuid();
      const eventId = "evt-001"; // mock

      localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
      localStorage.setItem(STORAGE_KEYS.prenom, cleanPrenom);
      localStorage.setItem(STORAGE_KEYS.eventId, eventId);
      localStorage.setItem(STORAGE_KEYS.avatarUrl, avatar ?? "null");
      if (cleanEmail) {
        localStorage.setItem(STORAGE_KEYS.email, cleanEmail);
        localStorage.setItem(STORAGE_KEYS.rgpd, rgpd ? "1" : "0");
      } else {
        localStorage.removeItem(STORAGE_KEYS.email);
        localStorage.removeItem(STORAGE_KEYS.rgpd);
      }

      onEnter({
        deviceId,
        prenom: cleanPrenom,
        initial: (cleanPrenom[0] ?? "?").toUpperCase(),
        avatarColor: pickAvatarColor(cleanPrenom),
        eventId,
        avatarUrl: avatar,
        email: cleanEmail,
        rgpdAccepted: !!cleanEmail && rgpd,
      });
    }, 280);
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-xl border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
      hasError
        ? "border-destructive focus:border-destructive"
        : "border-border focus:border-primary"
    }`;

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

          <h1 className="font-display text-3xl leading-tight text-foreground">
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

          <form onSubmit={submit} className="space-y-4" noValidate>
            {/* Code */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="code"
                  className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Code d'accès
                </label>
                <Badge tone="required">Obligatoire</Badge>
              </div>
              <input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (errors.code) setErrors((x) => ({ ...x, code: undefined }));
                }}
                placeholder="JULIE2026"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                maxLength={64}
                disabled={isLocked}
                aria-invalid={!!errors.code}
                className={`${inputClass(!!errors.code)} font-mono uppercase tracking-wider`}
              />
              {errors.code && (
                <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
                  {errors.code}
                </p>
              )}
            </div>

            {/* Prénom */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="prenom"
                  className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Votre prénom
                </label>
                <Badge tone="required">Obligatoire</Badge>
              </div>
              <input
                id="prenom"
                value={prenom}
                onChange={(e) => {
                  setPrenom(e.target.value);
                  if (errors.prenom)
                    setErrors((x) => ({ ...x, prenom: undefined }));
                }}
                placeholder="Votre prénom"
                autoComplete="given-name"
                maxLength={40}
                disabled={isLocked}
                aria-invalid={!!errors.prenom}
                className={inputClass(!!errors.prenom)}
              />
              {errors.prenom && (
                <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
                  {errors.prenom}
                </p>
              )}
            </div>

            {/* Email (optionnel) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Email
                </label>
                <Badge tone="recommended">Recommandé</Badge>
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email)
                    setErrors((x) => ({ ...x, email: undefined }));
                }}
                placeholder="vous@email.com"
                autoComplete="email"
                inputMode="email"
                maxLength={255}
                disabled={isLocked}
                aria-invalid={!!errors.email}
                className={inputClass(!!errors.email)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pour recevoir vos photos après l'event.
              </p>
              {errors.email && (
                <p className="mt-1 text-xs font-medium text-destructive" role="alert">
                  {errors.email}
                </p>
              )}

              {/* Checkbox RGPD */}
              <label
                className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3 transition ${
                  email ? "" : "opacity-60"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${
                    rgpd
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                  aria-hidden
                >
                  {rgpd && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={rgpd}
                  onChange={(e) => setRgpd(e.target.checked)}
                  disabled={!email || isLocked}
                />
                <span className="text-xs leading-relaxed text-foreground/85">
                  J'accepte de recevoir mes photos par email
                </span>
              </label>
            </div>

            {/* Photo de profil (optionnelle) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Photo de profil
                </span>
                <Badge tone="optional">Optionnelle</Badge>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isLocked}
                  className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-card transition hover:opacity-90"
                  style={{
                    backgroundColor: avatar ? "transparent" : previewColor,
                  }}
                  aria-label="Ajouter une photo de profil"
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Aperçu de votre photo de profil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">
                      {previewInitial}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-xs text-muted-foreground">
                    JPG ou PNG · 5 Mo max
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="font-medium text-primary hover:underline"
                    >
                      {avatar ? "Changer" : "Choisir une photo"}
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        onClick={() => setAvatar(undefined)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickAvatar(e.target.files?.[0])}
                />
              </div>
            </div>

            {errors.global && (
              <p
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                role="alert"
              >
                {errors.global}
              </p>
            )}

            {isLocked && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                Trop de tentatives. Réessayez dans {remainingMin} min.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Accéder à la galerie"}
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