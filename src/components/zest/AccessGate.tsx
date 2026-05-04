import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Check } from "lucide-react";
import { ZestLogo } from "./Logo";
import {
  buildSession,
  getOrCreateDeviceId,
  LOGIN_KEYS,
  pickAvatarColor,
  type GuestSession,
} from "@/lib/zest-session";
import { loginToEvent } from "@/lib/zest-actions";

export type { GuestSession };

const GUEST_STORAGE_KEY = "zeste_guest_session";

export function loadGuest(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession> | null;
    // Validate shape — old/mock sessions stored under this key would crash the app.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.invite ||
      !parsed.event ||
      typeof (parsed.event as { id?: unknown }).id !== "string" ||
      typeof (parsed.invite as { id?: unknown }).id !== "string"
    ) {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      return null;
    }
    return parsed as GuestSession;
  } catch {
    try { localStorage.removeItem(GUEST_STORAGE_KEY); } catch {/* noop */}
    return null;
  }
}

export function saveGuest(s: GuestSession | null) {
  if (typeof window === "undefined") return;
  if (!s) localStorage.removeItem(GUEST_STORAGE_KEY);
  else localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(s));
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;

const schema = z.object({
  code: z.string().trim().min(1, "Code requis").max(64),
  prenom: z.string().trim().min(2, "Prénom trop court").max(40),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
});

function readAttempts() {
  const lockUntil = Number(localStorage.getItem(LOGIN_KEYS.lockUntil) || 0);
  if (lockUntil && Date.now() < lockUntil)
    return { locked: true, lockUntil, count: MAX_ATTEMPTS };
  if (lockUntil && Date.now() >= lockUntil) {
    localStorage.removeItem(LOGIN_KEYS.lockUntil);
    localStorage.removeItem(LOGIN_KEYS.attempts);
  }
  return {
    locked: false,
    lockUntil: 0,
    count: Number(localStorage.getItem(LOGIN_KEYS.attempts) || 0),
  };
}

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

export function AccessGate({
  slug,
  onEnter,
}: {
  slug: string;
  onEnter: (s: GuestSession) => void;
}) {
  const [code, setCode] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [rgpd, setRgpd] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>();
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

  useEffect(() => {
    // Clear any stale lockout from previous (buggy) login flow
    localStorage.removeItem(LOGIN_KEYS.attempts);
    localStorage.removeItem(LOGIN_KEYS.lockUntil);
    const a = readAttempts();
    if (a.locked) setLockUntil(a.lockUntil);
  }, []);
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
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setErrors({});
    const parsed = schema.safeParse({ code, prenom, email });
    if (!parsed.success) {
      const fe: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof errors;
        if (!fe[k]) fe[k] = i.message;
      }
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const result = await loginToEvent({
        slug,
        code: parsed.data.code,
        prenom: parsed.data.prenom,
        email: parsed.data.email || undefined,
        rgpd,
        deviceId,
        avatarUrl: avatar,
      });

      if (!result.ok) {
        if (result.reason === "banned") {
          setErrors({ global: "Accès refusé : cet appareil a été banni de cet événement." });
          return;
        }
        if (result.reason === "bad_code" || result.reason === "event_not_found") {
          const next = Number(localStorage.getItem(LOGIN_KEYS.attempts) || 0) + 1;
          localStorage.setItem(LOGIN_KEYS.attempts, String(next));
          if (next >= MAX_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_MS;
            localStorage.setItem(LOGIN_KEYS.lockUntil, String(until));
            setLockUntil(until);
            setErrors({ global: "Trop de tentatives. Réessayez dans 5 minutes." });
          } else {
            setErrors({
              code: `Code incorrect (${MAX_ATTEMPTS - next} tentative${
                MAX_ATTEMPTS - next > 1 ? "s" : ""
              } restante${MAX_ATTEMPTS - next > 1 ? "s" : ""})`,
            });
          }
        } else {
          setErrors({ global: "Connexion impossible, réessayez." });
        }
        return;
      }

      localStorage.removeItem(LOGIN_KEYS.attempts);
      localStorage.removeItem(LOGIN_KEYS.lockUntil);
      onEnter(buildSession(result.invite, result.event));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-xl border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
      hasError
        ? "border-destructive focus:border-destructive"
        : "border-border focus:border-primary"
    }`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[image:var(--gradient-warm)]">
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
            Bienvenue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrez le code de votre invitation pour rejoindre la galerie.
          </p>

          <div className="my-6 h-px bg-border" />

          {errors.global && (
            <div className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
              {errors.global}
              {isLocked && remainingMin > 0 && ` (${remainingMin} min)`}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="code" className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                autoCapitalize="characters"
                maxLength={64}
                disabled={isLocked || loading}
                className={`${inputClass(!!errors.code)} font-mono uppercase tracking-wider`}
              />
              {errors.code && (
                <p className="mt-1.5 text-xs font-medium text-destructive">{errors.code}</p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="prenom" className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Votre prénom
                </label>
                <Badge tone="required">Obligatoire</Badge>
              </div>
              <input
                id="prenom"
                value={prenom}
                onChange={(e) => {
                  setPrenom(e.target.value);
                  if (errors.prenom) setErrors((x) => ({ ...x, prenom: undefined }));
                }}
                placeholder="Votre prénom"
                maxLength={40}
                disabled={isLocked || loading}
                className={inputClass(!!errors.prenom)}
              />
              {errors.prenom && (
                <p className="mt-1.5 text-xs font-medium text-destructive">{errors.prenom}</p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
                }}
                placeholder="vous@email.com"
                maxLength={255}
                disabled={isLocked || loading}
                className={inputClass(!!errors.email)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pour recevoir vos photos après l'event.
              </p>
              {errors.email && (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.email}</p>
              )}

              <label
                className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3 transition ${
                  email ? "" : "opacity-60"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${
                    rgpd ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {rgpd && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={rgpd}
                  onChange={(e) => setRgpd(e.target.checked)}
                  disabled={!email || isLocked || loading}
                />
                <span className="text-xs leading-relaxed text-foreground/85">
                  J'accepte de recevoir mes photos par email
                </span>
              </label>
            </div>

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
                  disabled={isLocked || loading}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-card"
                  style={{ backgroundColor: avatar ? "transparent" : previewColor }}
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white">
                      {previewInitial}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-xs text-muted-foreground">JPG ou PNG · 5 Mo max</p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                  >
                    {avatar ? "Changer" : "Choisir une photo"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => onPickAvatar(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLocked || loading}
              className="mt-2 w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Connexion…" : "Rejoindre la galerie"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}