import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
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
    <div className="gi-shell">
      {/* ── Brand panel ── */}
      <aside className="gi-brand">
        {eventInfo?.cover_url && (
          <img
            src={eventInfo.cover_url}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.12,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        <div className="gi-brand-top">
          <span className="gi-logo">
            <span className="gi-logo-dot" />
            Kapsul
          </span>
        </div>

        <div className="gi-hero">
          <span className="gi-eyebrow">
            <span className="gi-eyebrow-dot" />
            Galerie privée
          </span>
          <h1 className="gi-event-title">
            {eventInfo?.titre ?? "Rejoignez la galerie"}
          </h1>
          {eventInfo?.event_date && (
            <p className="gi-event-meta">
              {new Date(eventInfo.event_date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {eventInfo.lieu ? ` · ${eventInfo.lieu}` : ""}
            </p>
          )}
          <p className="gi-event-meta" style={{ marginBottom: 0, fontSize: 15 }}>
            Partagez vos plus beaux clichés, retrouvez ceux des autres invités, et récupérez l'album complet à la fin de l'événement.
          </p>
        </div>

        <div className="gi-polaroid-stack" aria-hidden>
          <div className="gi-polaroid gi-poly-1"><div className="gi-poly-img" /></div>
          <div className="gi-polaroid gi-poly-2"><div className="gi-poly-img" /></div>
          <div className="gi-polaroid gi-poly-3"><div className="gi-poly-img" /></div>
        </div>

        <div className="gi-brand-footer">
          <span>Propulsé par <strong>Kapsul</strong></span>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="gi-form-panel">
        <div className="gi-form-inner gi-screen">
          <h2 className="gi-h1">Vous êtes invité !</h2>
          <p className="gi-sub">Entrez vos informations pour rejoindre la galerie photo.</p>

          {errors.global && (
            <div
              role="alert"
              style={{
                marginBottom: 20,
                padding: "12px 14px",
                background: "#FFF5F4",
                border: "1px solid #FFD9D6",
                borderRadius: 12,
                color: "#FF4842",
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: '"Public Sans", sans-serif',
              }}
            >
              {errors.global}
              {isLocked && remainingMin > 0 && ` (${remainingMin} min)`}
            </div>
          )}

          <form onSubmit={submit} noValidate>
            {/* Code d'accès */}
            <div className="gi-field">
              <div className="gi-label-row">
                <span className="gi-label">Code d'accès</span>
                <span className="gi-badge">Obligatoire</span>
              </div>
              <input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (errors.code) setErrors((x) => ({ ...x, code: undefined }));
                }}
                placeholder="ex : JULIE2026"
                autoCapitalize="characters"
                maxLength={64}
                disabled={isLocked || loading}
                className={`gi-input uppercase${errors.code ? " is-error" : ""}`}
                name="event-code"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              {errors.code && (
                <div className="gi-help" style={{ color: "#FF4842" }}>{errors.code}</div>
              )}
            </div>

            {/* Prénom */}
            <div className="gi-field">
              <div className="gi-label-row">
                <span className="gi-label">Votre prénom</span>
                <span className="gi-badge">Obligatoire</span>
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
                className={`gi-input${errors.prenom || prenomAvailable === false ? " is-error" : ""}`}
                name="given-name"
                autoComplete="given-name"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
              />
              {prenomChecking && (
                <div className="gi-help">Vérification…</div>
              )}
              {!prenomChecking && prenomAvailable === true && (
                <div className="gi-help" style={{ color: "#00AB55", display: "flex", alignItems: "center", gap: 4 }}>
                  <Check style={{ width: 12, height: 12 }} strokeWidth={3} /> Prénom disponible
                </div>
              )}
              {!prenomChecking && prenomAvailable === false && (
                <div className="gi-help" style={{ color: "#FF4842" }}>
                  « {normalisePrenom(prenom)} » est déjà pris dans cet événement.
                </div>
              )}
              {errors.prenom && prenomAvailable !== false && (
                <div className="gi-help" style={{ color: "#FF4842" }}>{errors.prenom}</div>
              )}
              {prenomSuggestions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p className="gi-help">Choisissez une variante :</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {prenomSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setPrenom(s);
                          setErrors((x) => ({ ...x, prenom: undefined }));
                          setPrenomSuggestions([]);
                        }}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 100,
                          border: "1.5px solid rgba(255,72,66,0.3)",
                          background: "rgba(255,72,66,0.05)",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#212B36",
                          cursor: "pointer",
                          fontFamily: '"Public Sans", sans-serif',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="gi-field">
              <div className="gi-label-row">
                <span className="gi-label">Votre email</span>
                <span className="gi-badge">Obligatoire</span>
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
                className={`gi-input${errors.email ? " is-error" : ""}`}
                name="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="email"
              />
              {errors.email ? (
                <div className="gi-help" style={{ color: "#FF4842" }}>{errors.email}</div>
              ) : (
                <div className="gi-help">
                  Pour recevoir le ZIP des photos à la fin de l'événement.{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "#637381" }}>
                    Politique de confidentialité.
                  </a>
                </div>
              )}
            </div>

            {/* Photo de profil */}
            <div className="gi-field">
              <div className="gi-label-row">
                <span className="gi-label">Photo de profil</span>
                <span style={{ fontSize: 11, color: "#919EAB", fontFamily: '"Public Sans", sans-serif', textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>Optionnelle</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 14px",
                  border: "1.5px solid #E7E3DE",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isLocked || loading}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    flexShrink: 0,
                    overflow: "hidden",
                    background: avatar ? "transparent" : previewColor,
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                  }}
                >
                  {avatar ? (
                    <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontFamily: '"Josefin Sans", sans-serif',
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {previewInitial}
                    </span>
                  )}
                </button>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "#919EAB", fontFamily: '"Public Sans", sans-serif', margin: 0 }}>
                    JPG ou PNG · 5 Mo max
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#FF4842",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      marginTop: 4,
                      fontFamily: '"Public Sans", sans-serif',
                    }}
                  >
                    {avatar ? "Changer" : "Choisir une photo"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => onPickAvatar(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLocked || loading} className="gi-cta">
              {loading ? "Connexion…" : "Rejoindre la galerie →"}
            </button>

            <p className="gi-footnote">
              En continuant, vous acceptez les{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">conditions</a>{" "}
              et la{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}