import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bug, Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Screenshot = {
  name: string;
  contentType: string;
  dataUrl: string;
  size: number;
};

const ACCENT = "#FF4842";
const ACCENT_LIGHT = "rgba(255,72,66,0.12)";
const TEXT_PRIMARY = "#212B36";
const TEXT_SECONDARY = "#637381";
const TEXT_DISABLED = "#919EAB";
const BG_NEUTRAL = "#F4F6F8";
const SUCCESS = "#00AB55";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Autre";
}
function detectOS(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return "Autre";
}

function shouldShowOnPath(pathname: string): boolean {
  if (!pathname) return false;
  // Hide on login / auth / public gallery pages
  if (pathname === "/" || pathname === "/login") return false;
  if (pathname.startsWith("/reset-password") || pathname.startsWith("/set-password")) return false;
  if (pathname.startsWith("/e/")) return false; // public guest gallery
  if (pathname.startsWith("/closed")) return false;
  if (pathname.startsWith("/lovable/")) return false;
  return true;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read error"));
    r.readAsDataURL(file);
  });
}

export function BugReportWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = shouldShowOnPath(pathname);
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Signaler un problème"
        title="Signaler un problème"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: ACCENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(255,72,66,0.35)",
          display: "grid",
          placeItems: "center",
          zIndex: 9999,
        }}
      >
        <Bug size={22} />
      </button>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function BugReportModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [asWho, setAsWho] = useState("");
  const [wasDoing, setWasDoing] = useState("");
  const [wantedTo, setWantedTo] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ticketNumber: number | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill email from Supabase session
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const e = data.session?.user.email;
        if (!cancel && e) {
          setEmail(e);
          setEmailLocked(true);
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const tech = useMemo(() => {
    if (typeof window === "undefined") {
      return { url: "", ua: "", browser: "", os: "", dateLabel: "" };
    }
    const ua = navigator.userAgent;
    return {
      url: window.location.href,
      ua,
      browser: detectBrowser(ua),
      os: detectOS(ua),
      dateLabel: new Date().toLocaleString("fr-FR"),
    };
  }, []);

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    asWho.trim().length > 0 &&
    wasDoing.trim().length > 0 &&
    wantedTo.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const next: Screenshot[] = [...shots];
    for (const f of arr) {
      if (next.length >= MAX_FILES) break;
      if (!ACCEPTED.includes(f.type)) {
        setError(`Format non supporté : ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name} dépasse 5 Mo`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(f);
        next.push({ name: f.name, contentType: f.type, dataUrl, size: f.size });
      } catch {
        setError(`Impossible de lire ${f.name}`);
      }
    }
    setShots(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          asWho: asWho.trim(),
          wasDoing: wasDoing.trim(),
          wantedTo: wantedTo.trim(),
          expectedBehavior: expectedBehavior.trim(),
          contactEmail: email.trim(),
          contactPhone: phone.trim(),
          pageUrl: tech.url,
          browser: tech.browser,
          os: tech.os,
          userAgent: tech.ua,
          dateLabel: tech.dateLabel,
          screenshots: shots.map((s) => ({
            name: s.name,
            contentType: s.contentType,
            dataUrl: s.dataUrl,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setSuccess({ ticketNumber: body?.ticketNumber ?? null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[bug-report] submit failed", msg);
      setError(
        "Une erreur s'est produite lors de l'envoi. Réessayez ou contactez contact@kapsul.events.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
        fontFamily: "'Public Sans', system-ui, sans-serif",
        color: TEXT_PRIMARY,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 560,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: TEXT_SECONDARY,
            display: "grid",
            placeItems: "center",
          }}
        >
          <X size={18} />
        </button>

        {success ? (
          <div style={{ textAlign: "center", padding: "24px 8px 8px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(0,171,85,0.12)",
                color: SUCCESS,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                fontSize: 28,
              }}
            >
              ✓
            </div>
            <h2 style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 20, margin: "0 0 8px" }}>
              Rapport envoyé, merci !
            </h2>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: "0 0 20px", lineHeight: 1.5 }}>
              {success.ticketNumber ? (
                <>Ticket <strong>#{success.ticketNumber}</strong> — notre équipe a bien reçu votre signalement.<br /></>
              ) : (
                <>Notre équipe a bien reçu votre signalement.<br /></>
              )}
              Nous vous répondrons à <strong>{email}</strong> dans les plus brefs délais.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: ACCENT,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 style={{ fontFamily: "'Josefin Sans', sans-serif", fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
              Signaler un problème
            </h2>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: "0 0 20px" }}>
              Votre retour nous aide à améliorer Kapsul.
            </p>

            <Field label="Titre" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Le bouton Upload ne répond plus"
                maxLength={200}
                style={inputStyle}
              />
            </Field>

            <Field label="Que s'est-il passé ?" required>
              <p style={{ fontSize: 12, color: TEXT_DISABLED, margin: "0 0 8px" }}>
                Ce format aide notre équipe à comprendre le contexte rapidement.
              </p>
              <input
                type="text"
                value={asWho}
                onChange={(e) => setAsWho(e.target.value)}
                placeholder="En tant que… (ex : invité, organisateur)"
                maxLength={500}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <input
                type="text"
                value={wasDoing}
                onChange={(e) => setWasDoing(e.target.value)}
                placeholder="Je faisais… (ex : uploader une photo)"
                maxLength={500}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <input
                type="text"
                value={wantedTo}
                onChange={(e) => setWantedTo(e.target.value)}
                placeholder="Parce que je voulais… (ex : partager un souvenir)"
                maxLength={500}
                style={inputStyle}
              />
            </Field>

            <Field label="Ce qui aurait dû se passer (optionnel)">
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="Ex : La photo aurait dû apparaître dans le feed."
                rows={3}
                maxLength={2000}
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
            </Field>

            <Field label="Captures d'écran (optionnel)">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
                }}
                style={{
                  border: `1.5px dashed ${TEXT_DISABLED}`,
                  borderRadius: 8,
                  padding: 16,
                  textAlign: "center",
                  cursor: "pointer",
                  color: TEXT_SECONDARY,
                  fontSize: 13,
                  background: BG_NEUTRAL,
                }}
              >
                Glissez vos images ici ou cliquez pour sélectionner
                <div style={{ fontSize: 11, color: TEXT_DISABLED, marginTop: 4 }}>
                  jpg, png, webp, gif — max {MAX_FILES} fichiers, 5 Mo chacun
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(",")}
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {shots.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                  {shots.map((s, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: BG_NEUTRAL, aspectRatio: "1 / 1" }}>
                      <img src={s.dataUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => setShots(shots.filter((_, j) => j !== i))}
                        aria-label="Supprimer"
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Votre email" required>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => !emailLocked && setEmail(e.target.value)}
                  readOnly={emailLocked}
                  placeholder="vous@exemple.com"
                  style={{
                    ...inputStyle,
                    paddingRight: emailLocked ? 36 : 12,
                    background: emailLocked ? BG_NEUTRAL : "#fff",
                    color: emailLocked ? TEXT_SECONDARY : TEXT_PRIMARY,
                  }}
                />
                {emailLocked && (
                  <Lock
                    size={14}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DISABLED }}
                  />
                )}
              </div>
              {emailLocked && (
                <p style={{ fontSize: 11, color: TEXT_DISABLED, margin: "4px 0 0" }}>
                  Connecté en tant que {email}
                </p>
              )}
            </Field>

            <Field label="Téléphone (optionnel)">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Pour qu'on puisse vous rappeler si besoin"
                maxLength={40}
                style={inputStyle}
              />
            </Field>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: ACCENT_LIGHT,
                  color: ACCENT,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "13px 16px",
                borderRadius: 8,
                background: canSubmit ? ACCENT : "#FFB1AE",
                color: "#fff",
                border: "none",
                fontSize: 15,
                fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: "'Public Sans', sans-serif",
              }}
            >
              {submitting ? "Envoi en cours…" : "Envoyer le rapport"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #E5E8EB",
  fontSize: 14,
  fontFamily: "'Public Sans', sans-serif",
  color: TEXT_PRIMARY,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: ACCENT }}> *</span>}
      </label>
      {children}
    </div>
  );
}