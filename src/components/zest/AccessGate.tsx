import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSession,
  getOrCreateDeviceId,
  LOGIN_KEYS,
  pickAvatarColor,
  type GuestSession,
} from "@/lib/zest-session";
import {
  tryReconnectToEvent,
  registerInvite,
  generatePrenomSuggestions,
  normalisePrenom,
  checkPrenomAvailability,
  findEventBySlug,
  findEventByCode,
} from "@/lib/zest-actions";
import type { Tables } from "@/integrations/supabase/types";
import polyMariage from "@/assets/invite-mariage.jpg";
import polySoiree from "@/assets/invite-soiree.jpg";
import polyEvjf from "@/assets/invite-evjf.jpg";

export type { GuestSession };

const GUEST_STORAGE_KEY = "zeste_guest_session";

export function loadGuest(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession> | null;
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

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const step1Schema = z.object({
  code: z.string().trim().min(1, "Code requis").max(64),
  email: z.string().trim().email("Email invalide").max(255),
});

const FIRSTNAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

function readAttempts() {
  const lockUntil = Number(localStorage.getItem(LOGIN_KEYS.lockUntil) || 0);
  if (lockUntil && Date.now() < lockUntil)
    return { locked: true, lockUntil };
  if (lockUntil && Date.now() >= lockUntil) {
    localStorage.removeItem(LOGIN_KEYS.lockUntil);
    localStorage.removeItem(LOGIN_KEYS.attempts);
  }
  return { locked: false, lockUntil: 0 };
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="gi-step">
      <div className="gi-dots">
        {[1, 2].map((n) => (
          <span
            key={n}
            className={`gi-dot ${step === n ? "is-active" : step > n ? "is-done" : ""}`}
          />
        ))}
      </div>
      Étape {step} sur 2
    </div>
  );
}

function BrandPanel({ event }: { event: Tables<"events"> | null }) {
  return (
    <aside className="gi-brand">
      {event?.cover_url && (
        <img
          src={event.cover_url}
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
        <span className="gi-logo"><span className="gi-logo-dot" />Kapsul</span>
      </div>
      <div className="gi-hero">
        <span className="gi-eyebrow"><span className="gi-eyebrow-dot" />Galerie privée</span>
        <h1 className="gi-event-title">{event?.titre ?? "Rejoignez la galerie"}</h1>
        {event?.event_date && (
          <p className="gi-event-meta">
            {new Date(event.event_date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {event.lieu ? ` · ${event.lieu}` : ""}
          </p>
        )}
        <p className="gi-event-meta" style={{ marginBottom: 0, fontSize: 15 }}>
          Partagez vos plus beaux clichés, retrouvez ceux des autres invités, et récupérez l'album complet à la fin de l'événement.
        </p>
      </div>
      <div className="gi-polaroid-stack" aria-hidden>
        <div className="gi-polaroid gi-poly-1">
          <div className="gi-poly-img" style={{ backgroundImage: `url(${polyMariage})` }} />
          <div className="gi-poly-caption">Mariage</div>
        </div>
        <div className="gi-polaroid gi-poly-2">
          <div className="gi-poly-img" style={{ backgroundImage: `url(${polySoiree})` }} />
          <div className="gi-poly-caption">Soirée</div>
        </div>
        <div className="gi-polaroid gi-poly-3">
          <div className="gi-poly-img" style={{ backgroundImage: `url(${polyEvjf})` }} />
          <div className="gi-poly-caption">EVJF</div>
        </div>
      </div>
      <div className="gi-brand-footer">
        <span>Propulsé par <strong>Kapsul</strong></span>
      </div>
    </aside>
  );
}

export function AccessGate({
  slug,
  onEnter,
}: {
  slug: string;
  onEnter: (s: GuestSession) => void;
}) {
  // ── Shared state ──
  const [step, setStep] = useState<1 | 2>(1);
  const [eventInfo, setEventInfo] = useState<Tables<"events"> | null>(null);
  const [pendingEvent, setPendingEvent] = useState<Tables<"events"> | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  // ── Step 1 state ──
  const [s1Errors, setS1Errors] = useState<{ code?: string; email?: string }>({});
  const [s1Loading, setS1Loading] = useState(false);

  // ── Step 2 state ──
  const [prenom, setPrenom] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prenomChecking, setPrenomChecking] = useState(false);
  const [prenomAvailable, setPrenomAvailable] = useState<boolean | null>(null);
  const [prenomSuggestions, setPrenomSuggestions] = useState<string[]>([]);
  const [s2Error, setS2Error] = useState<string | null>(null);
  const [s2Loading, setS2Loading] = useState(false);

  // ── Admin-detected state ──
  const [adminDetected, setAdminDetected] = useState<{ slug: string } | null>(null);

  useEffect(() => {
    const a = readAttempts();
    if (a.locked) setLockUntil(a.lockUntil);
  }, []);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  // Load event info for the brand panel (by slug, fallback by code).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ev = await findEventBySlug(slug).catch(() => null);
      if (!cancelled && ev) { setEventInfo(ev); return; }
      const ev2 = await findEventByCode(slug).catch(() => null);
      if (!cancelled && ev2) setEventInfo(ev2);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Live prenom availability check on step 2.
  useEffect(() => {
    if (step !== 2) return;
    const c = code.trim();
    const p = prenom.trim();
    setPrenomAvailable(null);
    setPrenomSuggestions([]);
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
      if (res.status === "available") setPrenomAvailable(true);
      else if (res.status === "taken") {
        setPrenomAvailable(false);
        const norm = normalisePrenom(p);
        setPrenomSuggestions(generatePrenomSuggestions(norm, res.taken, 3));
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [step, code, prenom]);

  const isLocked = lockUntil > now;
  const remainingMin = Math.ceil((lockUntil - now) / 60000);
  const previewColor = pickAvatarColor(prenom || "?");
  const previewInitial = (prenom.trim()[0] ?? "+").toUpperCase();

  const onPickAvatar = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Step 1 submit ──
  const submitStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setS1Errors({});
    setGlobalError(null);

    const parsed = step1Schema.safeParse({ code, email });
    if (!parsed.success) {
      const fe: typeof s1Errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof fe;
        if (!fe[k]) fe[k] = i.message;
      }
      setS1Errors(fe);
      return;
    }

    setS1Loading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await tryReconnectToEvent({
        code: parsed.data.code,
        email: parsed.data.email,
        deviceId,
      });

      // Determine the event resolved by the code (for admin check),
      // regardless of whether the user is a returning guest or new.
      const resolvedEvent =
        res.ok ? res.event : res.reason === "new_user" ? res.event : null;

      if (resolvedEvent) {
        const emailNorm = parsed.data.email.trim().toLowerCase();
        const { data: isAdmin } = await supabase.rpc(
          "is_email_admin_of_event",
          { _event_id: resolvedEvent.id, _email: emailNorm },
        );
        if (isAdmin === true) {
          setEventInfo(resolvedEvent);
          setAdminDetected({ slug: resolvedEvent.slug });
          return;
        }
      }

      if (res.ok) {
        // Returning user → log in directly.
        localStorage.removeItem(LOGIN_KEYS.attempts);
        localStorage.removeItem(LOGIN_KEYS.lockUntil);
        onEnter(buildSession(res.invite, res.event));
        return;
      }

      if (res.reason === "bad_code") {
        const next = Number(localStorage.getItem(LOGIN_KEYS.attempts) || 0) + 1;
        localStorage.setItem(LOGIN_KEYS.attempts, String(next));
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          localStorage.setItem(LOGIN_KEYS.lockUntil, String(until));
          setLockUntil(until);
          setGlobalError("Trop de tentatives. Réessayez dans 5 minutes.");
        } else {
          setS1Errors({ code: `Code incorrect (${MAX_ATTEMPTS - next} restante${MAX_ATTEMPTS - next > 1 ? "s" : ""})` });
        }
        return;
      }
      if (res.reason === "banned") {
        setGlobalError("Accès refusé : cet appareil a été banni de cet événement.");
        return;
      }
      if (res.reason === "new_user") {
        // First connection → step 2.
        setPendingEvent(res.event);
        setEventInfo(res.event);
        setStep(2);
        return;
      }
      setGlobalError("Connexion impossible, réessayez.");
    } finally {
      setS1Loading(false);
    }
  };

  // ── Step 2 submit ──
  const submitStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingEvent) { setStep(1); return; }
    setS2Error(null);
    const trimmed = prenom.trim();
    if (trimmed.length < 2 || !FIRSTNAME_RE.test(trimmed)) {
      setS2Error("Prénom invalide (lettres uniquement).");
      return;
    }
    if (prenomAvailable === false) return;

    setS2Loading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      // Read avatar as data URL for now (legacy AccessGate did the same).
      const avatarUrl = avatarPreview ?? null;
      const res = await registerInvite({
        eventId: pendingEvent.id,
        prenom: trimmed,
        email,
        deviceId,
        avatarUrl,
      });
      if (!res.ok) {
        if (res.reason === "prenom_taken") {
          setPrenomAvailable(false);
          const norm = normalisePrenom(trimmed);
          setPrenomSuggestions(generatePrenomSuggestions(norm, [], 3));
          setS2Error(`« ${norm} » est déjà pris dans cet événement.`);
        } else {
          setS2Error("Création impossible, réessayez.");
        }
        return;
      }
      localStorage.removeItem(LOGIN_KEYS.attempts);
      localStorage.removeItem(LOGIN_KEYS.lockUntil);
      onEnter(buildSession(res.invite, pendingEvent));
    } finally {
      setS2Loading(false);
    }
    // Silence unused warning for avatarFile (kept for future R2 upload).
    void avatarFile;
  };

  return (
    <div className="gi-shell">
      <BrandPanel event={eventInfo} />
      <main className="gi-form-panel">
        <div className="gi-form-inner">
          {globalError && (
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
              {globalError}
              {isLocked && remainingMin > 0 && ` (${remainingMin} min)`}
            </div>
          )}

          {adminDetected && (
            <div className="gi-screen" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>👇</div>
              <p
                style={{
                  color: "#637381",
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 14,
                  lineHeight: 1.5,
                  margin: "0 0 20px",
                }}
              >
                Vous êtes organisateur de cet événement.
                <br />
                Connectez-vous à votre espace admin.
              </p>
              <Link
                to="/$slug/admin"
                params={{ slug: adminDetected.slug }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 20px",
                  border: "1px solid #FF4842",
                  color: "#FF4842",
                  background: "#fff",
                  borderRadius: 100,
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Accéder à mon espace admin →
              </Link>
              <button
                type="button"
                onClick={() => setAdminDetected(null)}
                style={{
                  marginTop: 16,
                  background: "none",
                  border: "none",
                  color: "#637381",
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Retour
              </button>
            </div>
          )}

          {!adminDetected && step === 1 && (
            <form className="gi-screen" onSubmit={submitStep1} noValidate>
              <StepDots step={1} />
              <h2 className="gi-h1">Vous êtes invité !</h2>
              <p className="gi-sub">Entrez le code d'accès et votre email pour rejoindre la galerie.</p>

              <div className="gi-field">
                <div className="gi-label-row">
                  <span className="gi-label">Code d'accès</span>
                  <span className="gi-badge">Obligatoire</span>
                </div>
                <input
                  className={`gi-input uppercase${s1Errors.code ? " is-error" : ""}`}
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ex : JULIE2026"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (s1Errors.code) setS1Errors((x) => ({ ...x, code: undefined }));
                  }}
                  maxLength={64}
                  disabled={isLocked || s1Loading}
                  autoFocus
                />
                {s1Errors.code && (
                  <div className="gi-error"><span className="gi-error-dot">!</span>{s1Errors.code}</div>
                )}
              </div>

              <div className="gi-field">
                <div className="gi-label-row">
                  <span className="gi-label">Votre email</span>
                  <span className="gi-badge">Obligatoire</span>
                </div>
                <input
                  className={`gi-input${s1Errors.email ? " is-error" : ""}`}
                  type="email"
                  autoComplete="email"
                  placeholder="vous@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (s1Errors.email) setS1Errors((x) => ({ ...x, email: undefined }));
                  }}
                  maxLength={255}
                  disabled={isLocked || s1Loading}
                />
                {s1Errors.email ? (
                  <div className="gi-error"><span className="gi-error-dot">!</span>{s1Errors.email}</div>
                ) : (
                  <div className="gi-help">
                    Pour vous reconnecter facilement et recevoir le ZIP des photos à la fin de l'événement.
                  </div>
                )}
              </div>

              <button type="submit" className="gi-cta" disabled={isLocked || s1Loading}>
                {s1Loading ? "Vérification…" : "Accéder à la galerie →"}
              </button>
              <p
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  marginBottom: 0,
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 13,
                  color: "#637381",
                }}
              >
                Organisateur / Administrateur ?{" "}
                <Link
                  to="/$slug/admin"
                  params={{ slug: eventInfo?.slug ?? slug }}
                  style={{ color: "#FF4842", textDecoration: "none", fontWeight: 600 }}
                >
                  Connectez-vous ici
                </Link>
              </p>
              <p className="gi-footnote">
                En continuant, vous acceptez les <a href="/privacy" target="_blank" rel="noopener noreferrer">conditions</a> et la{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>.
              </p>
            </form>
          )}

          {!adminDetected && step === 2 && (
            <form className="gi-screen" onSubmit={submitStep2} noValidate>
              <StepDots step={2} />

              <div className="gi-avatar-wrap">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`gi-avatar-btn${avatarPreview ? " has-img" : ""}`}
                  style={
                    avatarPreview
                      ? { backgroundImage: `url(${avatarPreview})` }
                      : { background: previewColor, borderColor: previewColor, color: "#fff" }
                  }
                  aria-label={avatarPreview ? "Changer la photo" : "Ajouter une photo"}
                >
                  {!avatarPreview && previewInitial}
                  {avatarPreview && <span className="gi-avatar-edit">✎</span>}
                </button>
                <button type="button" className="gi-avatar-action" onClick={() => fileRef.current?.click()}>
                  {avatarPreview ? "Changer la photo" : "Ajouter une photo"}
                </button>
                <span className="gi-avatar-hint">Optionnel · JPG ou PNG · 5 Mo max</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => onPickAvatar(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </div>

              <h2 className="gi-h1">Présentez-vous</h2>
              <p className="gi-sub">Pour que les autres invités sachent qui a pris quelle photo.</p>

              <div className="gi-field">
                <div className="gi-label-row">
                  <span className="gi-label">Votre prénom</span>
                  <span className="gi-badge">Obligatoire</span>
                </div>
                <input
                  className={`gi-input${prenomAvailable === false || s2Error ? " is-error" : ""}`}
                  type="text"
                  placeholder="Votre prénom"
                  value={prenom}
                  onChange={(e) => {
                    setPrenom(e.target.value);
                    if (s2Error) setS2Error(null);
                  }}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  maxLength={40}
                  disabled={s2Loading}
                  autoFocus
                />
                {prenomChecking && <div className="gi-help">Vérification…</div>}
                {!prenomChecking && prenomAvailable === true && (
                  <div className="gi-help" style={{ color: "#00AB55", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check style={{ width: 12, height: 12 }} strokeWidth={3} /> Prénom disponible
                  </div>
                )}
                {!prenomChecking && prenomAvailable === false && (
                  <div className="gi-error">
                    <span className="gi-error-dot">!</span>
                    « {normalisePrenom(prenom)} » est déjà pris dans cet événement.
                  </div>
                )}
                {s2Error && prenomAvailable !== false && (
                  <div className="gi-error"><span className="gi-error-dot">!</span>{s2Error}</div>
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
                            setS2Error(null);
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

              <div className="gi-cta-row">
                <button
                  type="button"
                  onClick={() => { setStep(1); setS2Error(null); }}
                  className="gi-cta-back"
                  aria-label="Retour"
                  disabled={s2Loading}
                >
                  ←
                </button>
                <button
                  type="submit"
                  className="gi-cta"
                  disabled={s2Loading || prenomChecking || prenomAvailable === false || prenom.trim().length < 2}
                  style={{ marginTop: 0, flex: 1 }}
                >
                  {s2Loading ? "Connexion…" : "Rejoindre la galerie →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}