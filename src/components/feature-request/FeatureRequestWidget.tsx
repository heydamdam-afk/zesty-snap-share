import { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#FF4842";
const ACCENT_LIGHT = "rgba(255,72,66,0.08)";
const TEXT_PRIMARY = "#212B36";
const TEXT_SECONDARY = "#637381";
const TEXT_DISABLED = "#919EAB";
const BG_NEUTRAL = "#F4F6F8";
const BORDER = "#E0E0E0";
const SUCCESS = "#00AB55";
const DARK = "#212B36";

const BENEFICIARIES = [
  "Les invités",
  "D'autres organisateurs",
  "Les agences événementielles",
  "Je ne sais pas",
];

const IMPORTANCE = [
  { value: "Bloquant", label: "🔥 Bloquant" },
  { value: "Important", label: "⏳ Important" },
  { value: "Nice to have", label: "💡 Nice to have" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontFamily: "'Public Sans', system-ui, sans-serif",
  fontSize: 14,
  color: TEXT_PRIMARY,
  background: BG_NEUTRAL,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

function Pill({
  selected,
  onClick,
  children,
  type = "button",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  type?: "button";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${selected ? ACCENT : BORDER}`,
        background: selected ? ACCENT_LIGHT : BG_NEUTRAL,
        color: selected ? ACCENT : TEXT_PRIMARY,
        fontFamily: "'Public Sans', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontFamily: "'Public Sans', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          marginBottom: hint ? 2 : 6,
        }}
      >
        {label}
        {required && <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>}
      </label>
      {hint && (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: "0 0 8px" }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

export function FeatureRequestWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 22px rgba(255,72,66,0.45)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,72,66,0.35)";
        }}
        style={{
          position: "fixed",
          right: 24,
          bottom: 84,
          padding: "12px 20px",
          borderRadius: 100,
          background: ACCENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Public Sans', system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 4px 16px rgba(255,72,66,0.35)",
          transition: "all .2s",
          zIndex: 9998,
        }}
      >
        💡 Suggérer une idée
      </button>
      {open && <FeatureRequestModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function FeatureRequestModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [asWho, setAsWho] = useState("");
  const [wantTo, setWantTo] = useState("");
  const [because, setBecause] = useState("");
  const [details, setDetails] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
  const [importance, setImportance] = useState<string>("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const e = data.session?.user.email;
        if (!cancel && e) setEmail(e);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-close after 4s on success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [success, onClose]);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      name.trim().length > 0 &&
      asWho.trim().length > 0 &&
      wantTo.trim().length > 0 &&
      because.trim().length > 0 &&
      importance.length > 0,
    [submitting, name, asWho, wantTo, because, importance],
  );

  function toggleBeneficiary(b: string) {
    setBeneficiaries((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          asWho: asWho.trim(),
          wantTo: wantTo.trim(),
          because: because.trim(),
          details: details.trim(),
          beneficiaries,
          importance,
          email: email.trim(),
          phone: phone.trim(),
          dateIso: new Date().toISOString(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[feature-request] submit failed", msg);
      setError("Une erreur s'est produite. Réessayez dans un instant.");
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
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
        fontFamily: "'Public Sans', system-ui, sans-serif",
        color: TEXT_PRIMARY,
        animation: "kapsulFadeIn .2s ease-out",
      }}
    >
      <style>{`
        @keyframes kapsulFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          position: "relative",
          animation: "kapsulFadeIn .2s ease-out",
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
          <div style={{ textAlign: "center", padding: "32px 8px 8px" }}>
            <div
              style={{
                fontSize: 48,
                lineHeight: 1,
                marginBottom: 16,
              }}
            >
              ✅
            </div>
            <h2
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 8px",
                color: TEXT_PRIMARY,
              }}
            >
              Merci pour votre retour !
            </h2>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, margin: "0 0 24px", lineHeight: 1.5 }}>
              Votre suggestion a bien été transmise à l'équipe Kapsul.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                color: ACCENT,
                border: `1.5px solid ${ACCENT}`,
                borderRadius: 8,
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2
              style={{
                fontFamily: "'Josefin Sans', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                margin: "0 0 4px",
                color: TEXT_PRIMARY,
              }}
            >
              Suggérer une fonctionnalité
            </h2>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, margin: "0 0 20px" }}>
              Votre retour nous aide à construire Kapsul.
            </p>

            <Field label="Nom de la fonctionnalité" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Réorganiser les photos par glisser-déposer"
                maxLength={200}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
            </Field>

            <Field
              label="Description du besoin"
              required
              hint="En tant que… / Je veux… / Parce que…"
            >
              <textarea
                value={asWho}
                onChange={(e) => setAsWho(e.target.value)}
                placeholder="En tant que… (ex : organisateur d'un mariage avec 150 invités)"
                rows={2}
                maxLength={500}
                style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
              <textarea
                value={wantTo}
                onChange={(e) => setWantTo(e.target.value)}
                placeholder="Je veux… (ex : pouvoir réorganiser les photos par glisser-déposer)"
                rows={2}
                maxLength={500}
                style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
              <textarea
                value={because}
                onChange={(e) => setBecause(e.target.value)}
                placeholder="Parce que… (ex : l'ordre actuel ne correspond pas à la chronologie de la soirée)"
                rows={3}
                maxLength={1000}
                style={{ ...inputStyle, resize: "vertical" }}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Détail du besoin / de la nouvelle fonctionnalité (ex : une interface drag & drop avec prévisualisation miniature, accessible sur mobile)"
                rows={4}
                maxLength={2000}
                style={{ ...inputStyle, resize: "vertical", marginTop: 8 }}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
            </Field>

            <Field label="Qui d'autre en bénéficierait ?">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BENEFICIARIES.map((b) => (
                  <Pill
                    key={b}
                    selected={beneficiaries.includes(b)}
                    onClick={() => toggleBeneficiary(b)}
                  >
                    {b}
                  </Pill>
                ))}
              </div>
            </Field>

            <Field label="Importance" required>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {IMPORTANCE.map((i) => (
                  <Pill
                    key={i.value}
                    selected={importance === i.value}
                    onClick={() => setImportance(i.value)}
                  >
                    {i.label}
                  </Pill>
                ))}
              </div>
            </Field>

            <Field label="Votre email" required hint="Récupéré automatiquement depuis votre compte.">
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{
                    ...inputStyle,
                    paddingRight: 36,
                    color: TEXT_SECONDARY,
                    cursor: "not-allowed",
                  }}
                />
                <Lock
                  size={14}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: TEXT_DISABLED,
                  }}
                />
              </div>
            </Field>

            <Field label="Téléphone" hint="Pour qu'on puisse vous rappeler si besoin.">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex : 06 12 34 56 78"
                maxLength={40}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = ACCENT)}
                onBlur={(e) => (e.target.style.borderColor = BORDER)}
              />
            </Field>

            {error && (
              <div
                style={{
                  background: "rgba(255,72,66,0.08)",
                  color: ACCENT,
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                background: DARK,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "14px",
                fontFamily: "'Public Sans', system-ui, sans-serif",
                fontSize: 15,
                fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.4,
                marginTop: 8,
                position: "relative",
                minHeight: 48,
              }}
            >
              {submitting ? (
                <span
                  aria-label="Envoi en cours"
                  style={{
                    display: "inline-block",
                    width: 18,
                    height: 18,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "kapsulSpin .8s linear infinite",
                  }}
                />
              ) : (
                "Envoyer ma suggestion →"
              )}
              <style>{`@keyframes kapsulSpin { to { transform: rotate(360deg); } }`}</style>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}