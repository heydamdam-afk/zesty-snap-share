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
import {
  loginToEvent,
  generatePrenomSuggestions,
  normalisePrenom,
  checkPrenomAvailability,
  findEventBySlug,
  findEventByCode,
} from "@/lib/zest-actions";
import type { Tables } from "@/integrations/supabase/types";

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
  email: z.string().trim().email("Email invalide").max(255),
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
  const [avatar, setAvatar] = useState<string | undefined>();
  const [eventInfo, setEventInfo] = useState<Tables<"events"> | null>(null);
  const [errors, setErrors] = useState<{
    code?: string;
    prenom?: string;
    email?: string;
    global?: string;
  }>({});
  const [prenomSuggestions, setPrenomSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [prenomChecking, setPrenomChecking] = useState(false);
  const [prenomAvailable, setPrenomAvailable] = useState<boolean | null>(null);
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

  // Charge les infos publiques de l'event (titre, cover) depuis le slug ou le code
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const evBySlug = await findEventBySlug(slug).catch(() => null);
      if (!cancelled && evBySlug) {
        setEventInfo(evBySlug);
        return;
      }
      const evByCode = await findEventByCode(slug).catch(() => null);
      if (!cancelled && evByCode) setEventInfo(evByCode);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  // Vérification temps réel du prénom (debounced) dès que code + prénom valides
  useEffect(() => {
    const c = code.trim();
    const p = prenom.trim();
    setPrenomAvailable(null);
    setPrenomSuggestions([]);
    if (errors.prenom) setErrors((x) => ({ ...x, prenom: undefined }));
    if (c.length < 3 || p.length < 2) {
      setPrenomChecking(false);
      return;
    }
    setPrenomChecking(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkPrenomAvailability({ code: c, prenom: p });
      if (cancelled) return;
      setPrenomChecking(false);
      if (res.status === "available") {
        setPrenomAvailable(true);
      } else if (res.status === "taken") {
        setPrenomAvailable(false);
        const norm = normalisePrenom(p);
        setPrenomSuggestions(generatePrenomSuggestions(norm, res.taken, 3));
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, prenom]);

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
    setPrenomSuggestions([]);
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
        email: parsed.data.email,
        deviceId,
        avatarUrl: avatar,
      });

      if (!result.ok) {
        if (result.reason === "banned") {
          setErrors({ global: "Accès refusé : cet appareil a été banni de cet événement." });
          return;
        }
        if (result.reason === "prenom_taken") {
          const norm = normalisePrenom(parsed.data.prenom);
          setErrors({ prenom: `« ${norm} » est déjà pris dans cet événement.` });
          setPrenomSuggestions(generatePrenomSuggestions(norm, [], 3));
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
          const detail =
            (result as { error?: { message?: string } }).error?.message;
          console.error("[AccessGate] login failed", result);
          setErrors({
            global: detail
              ? `Connexion impossible : ${detail}`
              : "Connexion impossible, réessayez.",
          });
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
      {eventInfo?.cover_url ? (
        <img
          src={eventInfo.cover_url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-15 blur-sm"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-background/40" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        {eventInfo?.titre && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 text-center"
          >
            <div className="text-3xl">🎉</div>
            <p className="mt-1 text-sm text-muted-foreground">Bienvenue à</p>
            <h2 className="font-display text-[26px] font-bold leading-tight text-foreground">
              {eventInfo.titre}
            </h2>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full rounded-3xl bg-card/95 p-7 shadow-card backdrop-blur"
        >
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
                name="event-code"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
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
                  if (prenomSuggestions.length) setPrenomSuggestions([]);
                }}
                placeholder="Votre prénom"
                maxLength={40}
                disabled={isLocked || loading}
                className={inputClass(!!errors.prenom || prenomAvailable === false)}
                name="given-name"
                autoComplete="given-name"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
              />
              {prenomChecking && (
                <p className="mt-1.5 text-xs text-muted-foreground">Vérification…</p>
              )}
              {!prenomChecking && prenomAvailable === true && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" strokeWidth={3} /> Prénom disponible
                </p>
              )}
              {!prenomChecking && prenomAvailable === false && (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                  « {normalisePrenom(prenom)} » est déjà pris dans cet événement.
                </p>
              )}
              {errors.prenom && prenomAvailable !== false && (
                <p className="mt-1.5 text-xs font-medium text-destructive">{errors.prenom}</p>
              )}
              {prenomSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-muted-foreground">Choisissez une variante :</p>
                  <div className="flex flex-wrap gap-2">
                    {prenomSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setPrenom(s);
                          setErrors((x) => ({ ...x, prenom: undefined }));
                          setPrenomSuggestions([]);
                        }}
                        className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[13px] font-medium text-foreground hover:bg-primary/10"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </label>
                <Badge tone="required">Obligatoire</Badge>
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
                name="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="email"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Votre email est utilisé uniquement pour retrouver vos photos.{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Voir notre politique de confidentialité.
                </a>
              </p>
              {errors.email && (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.email}</p>
              )}
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
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Propulsé par <span className="font-semibold">Kapsul</span>
        </p>
      </div>
    </div>
  );
}